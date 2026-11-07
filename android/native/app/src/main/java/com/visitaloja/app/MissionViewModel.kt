package com.visitaloja.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class MissionState(val missions: PublicContent<List<LojaMission>> = PublicContent(emptyList()), val ranking: PublicContent<List<ExplorerRank>> = PublicContent(emptyList()),
    val uid: String? = null, val ready: Set<String> = emptySet(), val errors: Set<String> = emptySet(), val cached: Set<String> = emptySet(),
    val profile: ExplorerProfile? = null, val progress: Map<String,MissionProgress> = emptyMap(), val badges: List<EarnedMissionBadge> = emptyList(),
    val preferenceRevision: Int = 0, val saving: Boolean = false, val message: String? = null, val now: Long = System.currentTimeMillis())

class MissionViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private val mutable = MutableStateFlow(MissionState())
    val state = mutable.asStateFlow()
    private val publicListeners = mutableListOf<ListenerRegistration>()
    private val userListeners = mutableListOf<ListenerRegistration>()
    private var publicGeneration = 0
    private var userGeneration = 0
    private var saveJob: Job? = null
    init {
        refreshPublic()
        viewModelScope.launch { while(true) { delay(30000); mutable.update { it.copy(now = System.currentTimeMillis()) } } }
    }
    fun refreshPublic() {
        val epoch = ++publicGeneration
        publicListeners.forEach { it.remove() }; publicListeners.clear()
        mutable.update { it.copy(missions = it.missions.copy(loading = true,error = false),ranking = it.ranking.copy(loading = true,error = false)) }
        publicListeners += db.collection("chabaquitoMissions").whereEqualTo("status","active").addSnapshotListener(MetadataChanges.INCLUDE) { snapshot,error ->
            if(epoch != publicGeneration) return@addSnapshotListener
            mutable.update { old -> old.copy(missions = if(error!=null || snapshot==null) old.missions.copy(loading = false,error = true) else PublicContent(snapshot.documents.mapNotNull { MissionPolicy.mission(it.id, missionData(it.data)) }.sortedBy { PlacePolicy.normalize(it.title) },false,false,snapshot.metadata.isFromCache)) }
        }
        publicListeners += db.collection("chabaquitoPublicRanking").orderBy("xp",com.google.firebase.firestore.Query.Direction.DESCENDING).limit(10).addSnapshotListener(MetadataChanges.INCLUDE) { snapshot,error ->
            if(epoch != publicGeneration) return@addSnapshotListener
            mutable.update { old -> old.copy(ranking = if(error!=null || snapshot==null) old.ranking.copy(loading=false,error=true) else PublicContent(snapshot.documents.mapNotNull { MissionPolicy.rank(it.id,missionData(it.data)) },false,false,snapshot.metadata.isFromCache)) }
        }
    }
    fun bind(uid: String?, force: Boolean = false) {
        if(!force && mutable.value.uid == uid) return
        val epoch = ++userGeneration
        saveJob?.cancel(); saveJob = null
        userListeners.forEach { it.remove() }; userListeners.clear()
        mutable.update { it.copy(uid=uid,ready=emptySet(),errors=emptySet(),cached=emptySet(),profile=null,progress=emptyMap(),badges=emptyList(),saving=false,message=null) }
        if(uid==null) return
        fun current() = epoch==userGeneration && mutable.value.uid==uid && auth.currentUser?.uid==uid
        fun status(name: String, failed: Boolean, cached: Boolean) {
            mutable.update { it.copy(ready=if(failed) it.ready-name else it.ready+name,errors=if(failed) it.errors+name else it.errors-name,cached=if(cached) it.cached+name else it.cached-name) }
        }
        userListeners += db.collection("chabaquitoExplorerProfiles").document(uid).addSnapshotListener(MetadataChanges.INCLUDE) { doc,error ->
            if(!current()) return@addSnapshotListener
            val failed=doc==null||error!=null
            status("profile",failed,doc?.metadata?.isFromCache==true)
            mutable.update { it.copy(profile=if(failed||doc?.exists()!=true) null else MissionPolicy.profile(missionData(doc.data))) }
        }
        userListeners += db.collection("chabaquitoMissionProgress").whereEqualTo("userId",uid).addSnapshotListener(MetadataChanges.INCLUDE) { snapshot,error ->
            if(!current()) return@addSnapshotListener
            val raw=snapshot?.documents?.map { missionData(it.data) } ?: emptyList()
            val rows=raw.mapNotNull { MissionPolicy.progress(it,uid) }
            val failed=snapshot==null||error!=null||rows.size!=raw.size
            status("progress",failed,snapshot?.metadata?.isFromCache==true)
            mutable.update { it.copy(progress=if(failed) emptyMap() else MissionPolicy.progressIndex(rows)) }
        }
        userListeners += db.collection("chabaquitoDigitalRewards").whereEqualTo("userId",uid).addSnapshotListener(MetadataChanges.INCLUDE) { snapshot,error ->
            if(!current()) return@addSnapshotListener
            val failed=snapshot==null||error!=null
            status("badges",failed,snapshot?.metadata?.isFromCache==true)
            mutable.update { it.copy(badges=if(failed) emptyList() else snapshot!!.documents.mapNotNull { MissionPolicy.reward(missionData(it.data),uid) }.sortedByDescending { it.unlocked ?: 0 }.distinctBy { it.missionId }) }
        }
    }
    fun clearMessage() { mutable.update { it.copy(message=null) } }
    fun savePreference(join: Boolean, alias: String) {
        val user=auth.currentUser ?: return; val uid=user.uid; val epoch=userGeneration
        if(mutable.value.uid!=uid || mutable.value.saving) return
        val value=if(join) alias.trim() else ""
        if(join && !MissionPolicy.validAlias(value)) { mutable.update { it.copy(message="Escribe un alias de hasta 40 caracteres, sin etiquetas ni saltos de línea.") }; return }
        mutable.update { it.copy(saving=true,message=null) }
        saveJob=viewModelScope.launch {
            fun current()=epoch==userGeneration && auth.currentUser?.uid==uid && mutable.value.uid==uid
            try {
                val token=user.getIdToken(false).await().token ?: error("Inicia sesión nuevamente.")
                if(!current()) return@launch
                val result=withContext(Dispatchers.IO) { NativeApi.post("https://www.visitaloja.com/api/chabaquito-ranking",token,JSONObject().put("participateInRanking",join).put("publicAlias",value)) }
                check(result.has("participateInRanking") && result.opt("participateInRanking")==join && result.optString("publicAlias")==value) { "No pudimos confirmar el cambio. Actualiza para consultar la preferencia guardada." }
                if(current()) mutable.update { it.copy(preferenceRevision=it.preferenceRevision+1,message=if(join) "Preferencia guardada. El ranking público muestra los 10 primeros por XP." else "Has dejado de participar en el ranking público.") }
            } catch(cancel: kotlinx.coroutines.CancellationException) { throw cancel }
            catch(error: Exception) { if(current()) mutable.update { it.copy(message=if(error is NativeHttpError || error is IllegalStateException) error.message else "No se pudo confirmar el cambio. Actualiza antes de reintentar.") } }
            finally { if(current()) mutable.update { it.copy(saving=false) } }
        }
    }
    override fun onCleared() { publicGeneration++;userGeneration++;saveJob?.cancel();publicListeners.forEach { it.remove() };userListeners.forEach { it.remove() };super.onCleared() }
}
private fun missionData(raw: Map<String,Any?>?): Map<String,Any?> = raw?.mapValues { (_,value) -> missionValue(value) } ?: emptyMap()
private fun missionValue(value: Any?): Any? = when(value) { is Timestamp -> value.toDate().time; is Map<*,*> -> value.entries.associate { it.key.toString() to missionValue(it.value) }; is List<*> -> value.map(::missionValue); else -> value }
