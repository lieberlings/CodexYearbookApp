package com.lieber.yearbookapp

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions

class YearbookFaceDetectionModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "YearbookFaceDetection"

  @ReactMethod
  fun detectFaces(uriString: String, promise: Promise) {
    val options = FaceDetectorOptions.Builder()
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
      .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
      .setMinFaceSize(0.08f)
      .build()
    val detector = FaceDetection.getClient(options)
    val image = try {
      InputImage.fromFilePath(reactContext, Uri.parse(uriString))
    } catch (error: Exception) {
      detector.close()
      promise.reject("YEARBOOK_FACE_INPUT", "Could not read image for face detection.", error)
      return
    }

    detector.process(image)
      .addOnSuccessListener { faces ->
        val faceArray = Arguments.createArray()
        faces.forEach { face ->
          val faceMap = Arguments.createMap()
          val boundsMap = Arguments.createMap()
          boundsMap.putDouble("x", face.boundingBox.left.toDouble())
          boundsMap.putDouble("y", face.boundingBox.top.toDouble())
          boundsMap.putDouble("width", face.boundingBox.width().toDouble())
          boundsMap.putDouble("height", face.boundingBox.height().toDouble())
          faceMap.putMap("bounds", boundsMap)
          faceMap.putDouble("headEulerAngleY", face.headEulerAngleY.toDouble())
          faceMap.putDouble("headEulerAngleZ", face.headEulerAngleZ.toDouble())
          if (face.smilingProbability != null) {
            faceMap.putDouble("smilingProbability", face.smilingProbability!!.toDouble())
          }
          if (face.leftEyeOpenProbability != null) {
            faceMap.putDouble("leftEyeOpenProbability", face.leftEyeOpenProbability!!.toDouble())
          }
          if (face.rightEyeOpenProbability != null) {
            faceMap.putDouble("rightEyeOpenProbability", face.rightEyeOpenProbability!!.toDouble())
          }
          if (face.trackingId != null) {
            faceMap.putInt("trackingId", face.trackingId!!)
          }
          faceArray.pushMap(faceMap)
        }

        val result = Arguments.createMap()
        result.putString("source", "android-mlkit-face-detection")
        result.putBoolean("available", true)
        result.putArray("faces", faceArray)
        detector.close()
        promise.resolve(result)
      }
      .addOnFailureListener { error ->
        detector.close()
        promise.reject("YEARBOOK_FACE_DETECTION_FAILED", "ML Kit face detection failed.", error)
      }
  }
}
