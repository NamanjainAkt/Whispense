// src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { CacheService } from './cache';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  registerForPushNotifications: async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data;

      if (!token) {
        console.warn('Could not retrieve push token');
        return null;
      }

      await CacheService.setFcmToken(token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
        });
      }

      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  scheduleDailyReminder: async (hour = 20, minute = 0) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Whispense Reminder',
        body: "Don't forget to log today's expenses!",
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: 'calendar',
        hour,
        minute,
        repeats: true,
      } as Notifications.CalendarTriggerInput,
    });
  },

  scheduleWeeklySummary: async (day = 0, hour = 10, minute = 0) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weekly Spending Summary',
        body: 'Tap to see how you spent this week!',
        data: { type: 'weekly_summary' },
      },
      trigger: {
        type: 'calendar',
        weekday: day,
        hour,
        minute,
        repeats: true,
      } as Notifications.CalendarTriggerInput,
    });
  },

  sendBudgetAlert: async (percentUsed: number) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Budget Alert',
        body: `You've used ${Math.round(percentUsed)}% of your monthly budget!`,
        data: { type: 'budget_alert' },
      },
      trigger: null,
    });
  },

  cancelAllNotifications: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
