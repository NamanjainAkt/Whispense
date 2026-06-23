import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface AudioRecordingResult {
  uri: string | null;
  base64?: string;
  duration?: number;
}

class AudioService {
  private recording: Audio.Recording | null = null;

  async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  async startRecording(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recording = recording;
    } catch (err) {
      console.error('Failed to start recording', err);
      throw err;
    }
  }

  async stopRecording(): Promise<AudioRecordingResult> {
    if (!this.recording) {
      return { uri: null };
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      const status = await this.recording.getStatusAsync();
      
      let base64 = '';
      if (uri) {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      this.recording = null;
      return {
        uri,
        base64,
        duration: status.isFinished ? status.durationMillis : 0,
      };
    } catch (err) {
      console.error('Failed to stop recording', err);
      throw err;
    }
  }
}

export default new AudioService();
