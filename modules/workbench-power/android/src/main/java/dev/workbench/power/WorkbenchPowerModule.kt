package dev.workbench.power

import android.content.Context
import android.os.Build
import android.os.PowerManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The power switch the widget's own refreshes depend on: whether Android exempts
 * this app from battery optimisation ("Unrestricted" on a Samsung, "Don't
 * optimise" on a Pixel). Reading it needs no permission and changes nothing; the
 * app only tells the person which way the switch is and opens the page it lives
 * on.
 */
class WorkbenchPowerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WorkbenchPower")

    /** Android 6+: true when this app is on the exemption list (Doze will not hold its work back). */
    Function("isIgnoringBatteryOptimizations") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        power.isIgnoringBatteryOptimizations(context.packageName)
      } else {
        true
      }
    }
  }
}
