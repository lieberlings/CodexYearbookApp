package com.lieber.yearbookapp

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions

class YearbookImageLabelingModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "YearbookImageLabeling"

  @ReactMethod
  fun labelImage(uriString: String, promise: Promise) {
    val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
    val image = try {
      InputImage.fromFilePath(reactContext, Uri.parse(uriString))
    } catch (error: Exception) {
      labeler.close()
      promise.reject("YEARBOOK_IMAGE_LABEL_INPUT", "Could not read image for labeling.", error)
      return
    }

    labeler.process(image)
      .addOnSuccessListener { labels ->
        val labelArray = Arguments.createArray()
        labels.forEach { label ->
          val labelMap = Arguments.createMap()
          labelMap.putString("text", label.text)
          labelMap.putDouble("confidence", label.confidence.toDouble())
          labelMap.putInt("index", label.index)
          labelArray.pushMap(labelMap)
        }

        val result = Arguments.createMap()
        result.putString("source", "android-mlkit-image-labeling")
        result.putBoolean("available", true)
        result.putArray("labels", labelArray)
        labeler.close()
        promise.resolve(result)
      }
      .addOnFailureListener { error ->
        labeler.close()
        promise.reject("YEARBOOK_IMAGE_LABELING_FAILED", "ML Kit image labeling failed.", error)
      }
  }
}
