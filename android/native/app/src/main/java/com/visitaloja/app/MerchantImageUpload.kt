package com.visitaloja.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

internal object MerchantImageUpload {
    suspend fun upload(context:Context,uri:Uri,place:String,purpose:String,uid:String):String {
        require(purpose in setOf("logo","hero","gallery")&&MerchantScanPolicy.placeId(place))
        val user=FirebaseAuth.getInstance().currentUser?.takeIf{it.uid==uid}?:error("Inicia sesión nuevamente.")
        val token=user.getIdToken(false).await().token?:error("Inicia sesión nuevamente.")
        return withContext(Dispatchers.IO){
            val input=context.contentResolver.openInputStream(uri)?:error("No se pudo abrir la imagen.")
            val source=input.use{stream->val out=ByteArrayOutputStream();val buffer=ByteArray(8192);while(true){val n=stream.read(buffer);if(n<0)break;require(out.size()+n<=12*1024*1024){"La imagen debe pesar menos de 12 MB."};out.write(buffer,0,n)};out.toByteArray()}
            val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeByteArray(source,0,source.size,bounds)
            require(bounds.outWidth>0&&bounds.outHeight>0&&bounds.outWidth.toLong()*bounds.outHeight<=100_000_000){"Formato o tamaño de imagen no compatible."}
            val options=BitmapFactory.Options().apply{var sample=1;while(bounds.outWidth/sample>1800||bounds.outHeight/sample>1800)sample*=2;inSampleSize=sample}
            var bitmap=BitmapFactory.decodeByteArray(source,0,source.size,options)?:error("No se pudo leer la imagen.")
            val orientation=runCatching{ExifInterface(source.inputStream()).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL)}.getOrDefault(1)
            val matrix=Matrix().apply{when(orientation){2->setScale(-1f,1f);3->setRotate(180f);4->setScale(1f,-1f);5->{setRotate(90f);postScale(-1f,1f)};6->setRotate(90f);7->{setRotate(-90f);postScale(-1f,1f)};8->setRotate(-90f)}}
            if(!matrix.isIdentity){val rotated=Bitmap.createBitmap(bitmap,0,0,bitmap.width,bitmap.height,matrix,true);if(rotated!==bitmap)bitmap.recycle();bitmap=rotated}
            val file=ByteArrayOutputStream().also{bitmap.compress(if(purpose=="logo")Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG,85,it)}.toByteArray();bitmap.recycle()
            require(FirebaseAuth.getInstance().currentUser?.uid==uid){"La sesión cambió."}
            val auth=NativeApi.post("https://www.visitaloja.com/api/sign-merchant-image",token,JSONObject().put("placeId",place).put("purpose",purpose))
            val cloud=auth.getString("cloudName");val params=auth.getJSONObject("params");val folder=params.getString("folder")
            require(cloud.matches(Regex("[A-Za-z0-9_-]+"))&&folder=="visitaloja/places/$place/$purpose"&&auth.getString("signature").matches(Regex("[a-f0-9]{40}")))
            val boundary="vl-"+java.util.UUID.randomUUID().toString()
            val connection=URL("https://api.cloudinary.com/v1_1/$cloud/image/upload").openConnection() as HttpURLConnection
            try{
                connection.requestMethod="POST";connection.instanceFollowRedirects=false;connection.connectTimeout=15000;connection.readTimeout=45000;connection.doOutput=true
                connection.setRequestProperty("Content-Type","multipart/form-data; boundary=$boundary")
                connection.outputStream.use{out->
                    fun field(key:String,value:String){require(!value.contains('\r')&&!value.contains('\n'));out.write(("--$boundary\r\nContent-Disposition: form-data; name=\"$key\"\r\n\r\n$value\r\n").toByteArray())}
                    listOf("folder","timestamp","upload_preset").forEach{field(it,params.get(it).toString())};field("api_key",auth.getString("apiKey"));field("signature",auth.getString("signature"))
                    val extension=if(purpose=="logo")"png" else "jpg"
                    out.write(("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"image.$extension\"\r\nContent-Type: image/"+(if(extension=="png")"png" else "jpeg")+"\r\n\r\n").toByteArray());out.write(file);out.write("\r\n--$boundary--\r\n".toByteArray())
                }
                check(connection.responseCode in 200..299){"No se pudo subir la imagen. Puedes reintentar."}
                val body=connection.inputStream.use{input->val out=ByteArrayOutputStream();val buffer=ByteArray(4096);while(true){val n=input.read(buffer);if(n<0)break;require(out.size()+n<=256000);out.write(buffer,0,n)};out.toByteArray()}
                val result=JSONObject(String(body,Charsets.UTF_8));val url=result.getString("secure_url");val parsed=java.net.URI(url)
                require(parsed.scheme=="https"&&parsed.host=="res.cloudinary.com"&&parsed.path.startsWith("/$cloud/image/upload/")&&result.getString("public_id").startsWith("$folder/")){"El proveedor devolvió una imagen fuera del destino autorizado."}
                url
            }finally{connection.disconnect()}
        }
    }
}
