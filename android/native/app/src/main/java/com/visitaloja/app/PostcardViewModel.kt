package com.visitaloja.app

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PostcardConfig(val settings: PostcardSettings=PostcardPolicy.settings(null,null),val loading: Boolean=true,val error: Boolean=false)
class PostcardViewModel: ViewModel() {
    private val mutable=MutableStateFlow(PostcardConfig());val state=mutable.asStateFlow()
    private var bound=false;private var epoch=0
    private var settings: Map<String,Any?>?=null;private var frames: Map<String,Any?>?=null
    private val ready=mutableSetOf<String>();private val errors=mutableSetOf<String>()
    private val listeners=mutableListOf<ListenerRegistration>()
    fun bind(active: Boolean,force: Boolean=false) {
        if(bound==active&&!force)return
        bound=active;val version=++epoch;listeners.forEach { it.remove() };listeners.clear();ready.clear();errors.clear()
        mutable.value=PostcardConfig(loading=active)
        if(!active)return
        for(id in listOf("postcards","postcard_frames"))listeners+=FirebaseFirestore.getInstance().collection("settings").document(id).addSnapshotListener(MetadataChanges.INCLUDE) { doc,error ->
            if(version!=epoch)return@addSnapshotListener
            if(error!=null||doc==null)errors+=id else { errors-=id;ready+=id;if(id=="postcards")settings=doc.data else frames=doc.data }
            mutable.value=PostcardConfig(PostcardPolicy.settings(settings,frames),ready.size<2&&errors.isEmpty(),errors.isNotEmpty())
        }
    }
    override fun onCleared(){epoch++;listeners.forEach { it.remove() };super.onCleared()}
}
