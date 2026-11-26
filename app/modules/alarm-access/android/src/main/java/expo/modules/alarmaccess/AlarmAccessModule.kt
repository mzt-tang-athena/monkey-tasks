package expo.modules.alarmaccess

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AlarmAccessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AlarmAccess")

    Function("hasDndAccess") {
      val manager = appContext.reactContext?.getSystemService(Context.NOTIFICATION_SERVICE)
      (manager as? NotificationManager)?.isNotificationPolicyAccessGranted ?: false
    }

    Function("openDndAccess") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      null
    }
  }
}
