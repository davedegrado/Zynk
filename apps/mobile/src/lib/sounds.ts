import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getSound } from '@zynk/shared';

/** Bundled, original sound assets keyed by catalog file name. */
const SOUND_ASSETS: Record<string, number> = {
  zynk_classic: require('../../assets/sounds/zynk_classic.wav'),
  zynk_boing: require('../../assets/sounds/zynk_boing.wav'),
  zynk_laser: require('../../assets/sounds/zynk_laser.wav'),
  zynk_coin: require('../../assets/sounds/zynk_coin.wav'),
  zynk_knock: require('../../assets/sounds/zynk_knock.wav'),
  zynk_chime: require('../../assets/sounds/zynk_chime.wav'),
  zynk_whoosh: require('../../assets/sounds/zynk_whoosh.wav'),
  zynk_thunder: require('../../assets/sounds/zynk_thunder.wav'),
  zynk_bubble: require('../../assets/sounds/zynk_bubble.wav'),
};

let configured = false;
const players = new Map<string, AudioPlayer>();

async function ensureMode() {
  if (configured) return;
  configured = true;
  // playsInSilentMode=false: the iOS silent switch always wins. We mix with other
  // audio instead of interrupting the user's music.
  await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
}

/** Plays a catalog sound in-app (foreground only). Unknown ids are ignored. */
export async function playSound(soundId: string | null | undefined, volume = 1) {
  const sound = getSound(soundId);
  const asset = sound ? SOUND_ASSETS[sound.file] : undefined;
  if (!sound || asset === undefined) return;
  try {
    await ensureMode();
    let player = players.get(sound.id);
    if (!player) {
      player = createAudioPlayer(asset);
      players.set(sound.id, player);
    }
    player.volume = volume;
    await player.seekTo(0);
    player.play();
  } catch {
    // Audio is a nice-to-have; never let it break a Speow.
  }
}

export const hasSoundAsset = (soundId: string) => !!getSound(soundId) && SOUND_ASSETS[getSound(soundId)!.file] !== undefined;
