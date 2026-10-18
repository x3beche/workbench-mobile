package dev.workbench.installer

import android.content.Context
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * What the in-app update needs from Android that no Expo module offers:
 * whether this app may hand an APK to the package installer ("Install
 * unknown apps"), and the SHA-256 of a downloaded file, read in blocks on a
 * background thread instead of 40 MB through JavaScript.
 */
class WorkbenchInstallerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WorkbenchInstaller")

    /** Android 8+: the per-app "Install unknown apps" switch; before that, the manifest's permission is enough. */
    Function("canInstall") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.packageManager.canRequestPackageInstalls() else true
    }

    /** The file's SHA-256, lower-case hex. `uri` is a file:// URI or a plain path. */
    AsyncFunction("sha256") { uri: String ->
      val path = if (uri.startsWith("file:")) Uri.parse(uri).path ?: uri.removePrefix("file://") else uri
      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(1 shl 16)
      FileInputStream(File(path)).use { stream ->
        while (true) {
          val n = stream.read(buffer)
          if (n < 0) break
          digest.update(buffer, 0, n)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it) }
    }
  }
}
