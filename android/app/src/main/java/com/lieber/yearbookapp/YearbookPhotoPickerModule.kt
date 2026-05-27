package com.lieber.yearbookapp

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class YearbookPhotoPickerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), PermissionListener {

  private var pendingPromise: Promise? = null
  private var pendingPermissionOptions: PickerOptions? = null
  private var pendingPermissionPromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_PICK_IMAGES) {
          return
        }

        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode != Activity.RESULT_OK || data == null) {
          promise.resolve(Arguments.createArray())
          return
        }

        val result = Arguments.createArray()
        val clipData = data.clipData
        if (clipData != null) {
          for (index in 0 until clipData.itemCount) {
            val uri = clipData.getItemAt(index).uri
            result.pushMap(buildAssetMap(uri))
          }
        } else {
          data.data?.let { uri ->
            result.pushMap(buildAssetMap(uri))
          }
        }
        promise.resolve(result)
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "YearbookPhotoPicker"

  @ReactMethod
  fun pickImages(options: ReadableMap, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("YEARBOOK_PHOTO_PICKER_NO_ACTIVITY", "No active Android activity is available.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("YEARBOOK_PHOTO_PICKER_BUSY", "Photo picker is already open.")
      return
    }
    if (pendingPermissionPromise != null) {
      promise.reject("YEARBOOK_PHOTO_PICKER_BUSY", "Photo picker permission request is already active.")
      return
    }

    val pickerOptions = PickerOptions.from(options)

    if (needsMediaLocationPermission()) {
      val permissionActivity = activity as? PermissionAwareActivity
      if (permissionActivity != null) {
        pendingPermissionOptions = pickerOptions
        pendingPermissionPromise = promise
        permissionActivity.requestPermissions(
          arrayOf(Manifest.permission.ACCESS_MEDIA_LOCATION),
          REQUEST_ACCESS_MEDIA_LOCATION,
          this
        )
        return
      }
    }

    launchPicker(activity, pickerOptions, promise)
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ): Boolean {
    if (requestCode != REQUEST_ACCESS_MEDIA_LOCATION) {
      return false
    }

    val promise = pendingPermissionPromise ?: return true
    val options = pendingPermissionOptions ?: PickerOptions()
    pendingPermissionPromise = null
    pendingPermissionOptions = null

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("YEARBOOK_PHOTO_PICKER_NO_ACTIVITY", "No active Android activity is available.")
      return true
    }
    launchPicker(activity, options, promise)
    return true
  }

  private fun launchPicker(activity: Activity, options: PickerOptions, promise: Promise) {
    val intent = Intent(ACTION_PICK_IMAGES).apply {
      type = "image/*"
      putExtra(EXTRA_PICK_IMAGES_MAX, options.selectionLimit.coerceIn(2, SAFE_SELECTION_LIMIT))
      putExtra(EXTRA_LOCAL_ONLY, false)
      if (!options.searchQuery.isNullOrEmpty()) {
        putExtra(
          EXTRA_PICK_IMAGES_HIGHLIGHT_SEARCH_RESULTS,
          Bundle().apply {
            putInt(KEY_PICK_IMAGES_HIGHLIGHT_TYPE, PICK_IMAGES_HIGHLIGHT_TYPE_EXPANDED)
            putString(KEY_PICK_IMAGES_HIGHLIGHT_SEARCH_TEXT_QUERY, options.searchQuery)
          }
        )
      }
    }

    if (intent.resolveActivity(activity.packageManager) == null) {
      promise.reject("YEARBOOK_PHOTO_PICKER_UNAVAILABLE", "Android Photo Picker is unavailable on this device.")
      return
    }

    pendingPromise = promise
    try {
      activity.startActivityForResult(intent, REQUEST_PICK_IMAGES)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("YEARBOOK_PHOTO_PICKER_FAILED", "Unable to open Android Photo Picker.", error)
    }
  }

  private fun buildAssetMap(uri: Uri) = Arguments.createMap().apply {
    val displayName = getDisplayName(uri)
    val size = getOpenableSize(uri)
    val dimensions = getImageDimensions(uri)
    val locationResult = getImageLocation(uri, displayName, size, dimensions)

    putString("uri", uri.toString())
    putString("fileName", displayName)
    if (dimensions != null) {
      putInt("width", dimensions.first)
      putInt("height", dimensions.second)
    }
    if (locationResult.location != null) {
      putMap("location", locationResult.location)
    }
    putMap("metadataDebug", locationResult.debug)
  }

  private fun getDisplayName(uri: Uri): String? {
    return try {
      reactContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (cursor.moveToFirst() && nameIndex >= 0) cursor.getString(nameIndex) else null
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun getOpenableSize(uri: Uri): Long? {
    return try {
      reactContext.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (cursor.moveToFirst() && sizeIndex >= 0) cursor.getLong(sizeIndex) else null
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun getImageDimensions(uri: Uri): Pair<Int, Int>? {
    return try {
      reactContext.contentResolver.openInputStream(uri)?.use { stream ->
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeStream(stream, null, options)
        if (options.outWidth > 0 && options.outHeight > 0) {
          Pair(options.outWidth, options.outHeight)
        } else {
          null
        }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun getImageLocation(
    uri: Uri,
    displayName: String?,
    size: Long?,
    dimensions: Pair<Int, Int>?
  ): LocationReadResult {
    val debug = Arguments.createMap().apply {
      putString("pickerAuthority", uri.authority)
      putBoolean("mediaLocationPermission", hasMediaLocationPermission())
      putBoolean("pickerExifAttempted", true)
    }

    val pickerLocation = readExifLocation(uri, debug, "picker")
    if (pickerLocation != null) {
      debug.putString("locationReadPath", "picker-uri")
      return LocationReadResult(pickerLocation, debug)
    }

    val directMediaStoreUri = resolveMediaStoreUriFromPickerUri(uri, debug)
    if (directMediaStoreUri != null) {
      val directLocation = readExifLocation(directMediaStoreUri, debug, "mediastoreDirect")
      if (directLocation != null) {
        debug.putString("locationReadPath", "mediastore-direct-uri")
        return LocationReadResult(directLocation, debug)
      }
    }

    debug.putBoolean("mediaStoreMatchAttempted", true)
    val mediaStoreUri = findMediaStoreMatch(displayName, size, dimensions, debug)
    if (mediaStoreUri == null) {
      debug.putString("locationReadPath", "none")
      return LocationReadResult(null, debug)
    }

    val mediaStoreLocation = readExifLocation(mediaStoreUri, debug, "mediastore")
    debug.putString("locationReadPath", if (mediaStoreLocation != null) "mediastore-uri" else "none")
    return LocationReadResult(mediaStoreLocation, debug)
  }

  private fun resolveMediaStoreUriFromPickerUri(uri: Uri, debug: WritableMap): Uri? {
    val numericSegments = uri.pathSegments.mapNotNull { segment -> segment.toLongOrNull() }
    debug.putString("pickerPathTail", uri.pathSegments.takeLast(4).joinToString("/"))
    if (numericSegments.isEmpty()) {
      debug.putString("mediaStoreDirectMatch", "no-numeric-segment")
      return null
    }

    val mediaId = numericSegments.last()
    debug.putDouble("mediaStoreDirectId", mediaId.toDouble())
    debug.putString("mediaStoreDirectMatch", "candidate")
    return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId)
  }

  private fun readExifLocation(uri: Uri, debug: WritableMap, label: String): WritableMap? {
    val originalUri = getOriginalMediaUri(uri, debug, label)
    val streamLocation = readExifLocationFromStream(originalUri, debug, "${label}Stream")
    if (streamLocation != null) {
      return streamLocation
    }
    val descriptorLocation = readExifLocationFromDescriptor(originalUri, debug, "${label}Descriptor")
    if (descriptorLocation != null) {
      return descriptorLocation
    }
    return null
  }

  private fun readExifLocationFromStream(uri: Uri, debug: WritableMap, label: String): WritableMap? {
    return try {
      reactContext.contentResolver.openInputStream(uri)?.use { stream ->
        val exif = ExifInterface(stream)
        val latLong = FloatArray(2)
        val hasLocation = exif.getLatLong(latLong)
        debug.putBoolean("${label}ExifLocation", hasLocation)
        if (hasLocation) {
          Arguments.createMap().apply {
            putDouble("latitude", latLong[0].toDouble())
            putDouble("longitude", latLong[1].toDouble())
          }
        } else {
          null
        }
      }
    } catch (error: Exception) {
      debug.putString("${label}ExifError", error.javaClass.simpleName)
      null
    }
  }

  private fun readExifLocationFromDescriptor(uri: Uri, debug: WritableMap, label: String): WritableMap? {
    return try {
      MediaStore.openFileDescriptor(reactContext.contentResolver, uri, "r", null)?.use { descriptor ->
        val exif = ExifInterface(descriptor.fileDescriptor)
        val latLong = FloatArray(2)
        val hasLocation = exif.getLatLong(latLong)
        debug.putBoolean("${label}ExifLocation", hasLocation)
        if (hasLocation) {
          Arguments.createMap().apply {
            putDouble("latitude", latLong[0].toDouble())
            putDouble("longitude", latLong[1].toDouble())
          }
        } else {
          null
        }
      }
    } catch (error: Exception) {
      debug.putString("${label}ExifError", error.javaClass.simpleName)
      null
    }
  }

  private fun findMediaStoreMatch(
    displayName: String?,
    size: Long?,
    dimensions: Pair<Int, Int>?,
    debug: WritableMap
  ): Uri? {
    if (displayName.isNullOrBlank()) {
      debug.putString("mediaStoreMatch", "missing-display-name")
      return null
    }

    val projection = arrayOf(
      MediaStore.Images.Media._ID,
      MediaStore.Images.Media.DISPLAY_NAME,
      MediaStore.Images.Media.SIZE,
      MediaStore.Images.Media.WIDTH,
      MediaStore.Images.Media.HEIGHT,
      MediaStore.Images.Media.DATE_TAKEN
    )
    val selection = "${MediaStore.Images.Media.DISPLAY_NAME} = ?"
    val selectionArgs = arrayOf(displayName)

    return try {
      reactContext.contentResolver.query(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        projection,
        selection,
        selectionArgs,
        "${MediaStore.Images.Media.DATE_TAKEN} DESC"
      )?.use { cursor ->
        val idIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
        val sizeIndex = cursor.getColumnIndex(MediaStore.Images.Media.SIZE)
        val widthIndex = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH)
        val heightIndex = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT)
        var bestId: Long? = null
        var bestScore = 0
        var inspected = 0

        while (cursor.moveToNext() && inspected < MAX_MEDIASTORE_MATCH_CANDIDATES) {
          inspected += 1
          var score = 100
          val candidateSize = if (sizeIndex >= 0) cursor.getLong(sizeIndex) else null
          if (size != null && size > 0 && candidateSize == size) {
            score += 90
          }
          val candidateWidth = if (widthIndex >= 0) cursor.getInt(widthIndex) else 0
          val candidateHeight = if (heightIndex >= 0) cursor.getInt(heightIndex) else 0
          if (dimensions != null) {
            if (candidateWidth == dimensions.first && candidateHeight == dimensions.second) {
              score += 60
            } else if (candidateWidth == dimensions.second && candidateHeight == dimensions.first) {
              score += 40
            }
          }
          if (score > bestScore) {
            bestScore = score
            bestId = cursor.getLong(idIndex)
          }
        }

        debug.putInt("mediaStoreCandidates", inspected)
        debug.putInt("mediaStoreMatchScore", bestScore)
        if (bestId != null && bestScore >= MEDIASTORE_MATCH_THRESHOLD) {
          debug.putString("mediaStoreMatch", "matched")
          ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, bestId!!)
        } else {
          debug.putString("mediaStoreMatch", "low-score")
          null
        }
      }
    } catch (error: Exception) {
      debug.putString("mediaStoreMatch", "error")
      debug.putString("mediaStoreMatchError", error.javaClass.simpleName)
      null
    }
  }

  private fun getOriginalMediaUri(uri: Uri, debug: WritableMap? = null, label: String? = null): Uri {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !hasMediaLocationPermission()) {
      if (debug != null && label != null) {
        debug.putString("${label}OriginalUri", "not-required")
      }
      return uri
    }
    return try {
      val originalUri = MediaStore.setRequireOriginal(uri)
      if (debug != null && label != null) {
        debug.putString("${label}OriginalUri", "requested")
      }
      originalUri
    } catch (error: Exception) {
      if (debug != null && label != null) {
        debug.putString("${label}OriginalUri", "failed:${error.javaClass.simpleName}")
      }
      uri
    }
  }

  private fun needsMediaLocationPermission(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasMediaLocationPermission()
  }

  private fun hasMediaLocationPermission(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        reactContext,
        Manifest.permission.ACCESS_MEDIA_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
  }

  private data class PickerOptions(
    val selectionLimit: Int = DEFAULT_SELECTION_LIMIT,
    val searchQuery: String? = null
  ) {
    companion object {
      fun from(options: ReadableMap): PickerOptions {
        return PickerOptions(
          selectionLimit = if (options.hasKey("selectionLimit")) options.getInt("selectionLimit") else DEFAULT_SELECTION_LIMIT,
          searchQuery = if (options.hasKey("searchQuery") && !options.isNull("searchQuery")) {
            options.getString("searchQuery")?.trim()
          } else {
            null
          }
        )
      }
    }
  }

  private data class LocationReadResult(
    val location: WritableMap?,
    val debug: WritableMap
  )

  companion object {
    private const val REQUEST_PICK_IMAGES = 4107
    private const val REQUEST_ACCESS_MEDIA_LOCATION = 4108
    private const val DEFAULT_SELECTION_LIMIT = 50
    private const val SAFE_SELECTION_LIMIT = 100
    private const val MAX_MEDIASTORE_MATCH_CANDIDATES = 50
    private const val MEDIASTORE_MATCH_THRESHOLD = 150
    private const val ACTION_PICK_IMAGES = "android.provider.action.PICK_IMAGES"
    private const val EXTRA_PICK_IMAGES_MAX = "android.provider.extra.PICK_IMAGES_MAX"
    private const val EXTRA_PICK_IMAGES_HIGHLIGHT_SEARCH_RESULTS =
      "android.provider.extra.PICK_IMAGES_HIGHLIGHT_SEARCH_RESULTS"
    private const val KEY_PICK_IMAGES_HIGHLIGHT_TYPE = "android.provider.media.key.PICK_IMAGES_HIGHLIGHT_TYPE"
    private const val KEY_PICK_IMAGES_HIGHLIGHT_SEARCH_TEXT_QUERY =
      "android.provider.media.key.PICK_IMAGES_HIGHLIGHT_SEARCH_TEXT_QUERY"
    private const val PICK_IMAGES_HIGHLIGHT_TYPE_EXPANDED = 1
    private const val EXTRA_LOCAL_ONLY = "android.intent.extra.LOCAL_ONLY"
  }
}
