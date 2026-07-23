/* ============================================================
   Kobciye — Student photo service (frontend prototype)

   Camera + gallery capture for a student profile photo. The image URI is
   stored LOCALLY only (AsyncStorage, via the central student registry's
   photo_uri and the shared photo cache) — there is NO backend / cloud
   upload. Real image storage + access control must be added later.

   expo-image-picker is required lazily on native only (importing it on web
   crashes at load); web falls back to an <input type=file> (with capture
   for the camera).
   ============================================================ */
import { Platform } from 'react-native';
import { updateStudent, getStudentByInternalId } from './appDataRepository';

/* ---- web pickers (file input; `capture` opens the camera on phones) ---- */
function pickWeb(capture) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve({ uri: null });
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.capture = 'environment';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve({ uri: null });
      const reader = new FileReader();
      reader.onload = () => resolve({ uri: reader.result });
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/* ---- native pickers (expo-image-picker, lazily required) ---- */
async function pickNative(useCamera) {
  let ImagePicker;
  try { ImagePicker = require('expo-image-picker'); } catch (e) { return { uri: null, error: 'unavailable' }; }
  // request the right permission first
  const permFn = useCamera ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
  try {
    const perm = await permFn();
    if (perm && perm.status !== 'granted') return { uri: null, denied: true };
  } catch (e) { return { uri: null, denied: true }; }

  const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  try {
    const res = useCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets && res.assets[0]) return { uri: res.assets[0].uri };
  } catch (e) { /* prototype: swallow */ }
  return { uri: null };
}

/* pick from the gallery — resolves { uri } | { denied:true } | { uri:null } */
export async function pickStudentImageFromGallery() {
  return Platform.OS === 'web' ? pickWeb(false) : pickNative(false);
}

/* take a new photo with the camera */
export async function takeStudentPhotoWithCamera() {
  return Platform.OS === 'web' ? pickWeb(true) : pickNative(true);
}

/* persist a student's photo URI into the central registry (photo_uri) */
export async function saveStudentPhoto(studentInternalId, photoUri) {
  if (!studentInternalId) return null;
  return updateStudent(studentInternalId, { photo_uri: photoUri });
}

/* clear a student's photo */
export async function removeStudentPhoto(studentInternalId) {
  if (!studentInternalId) return null;
  return updateStudent(studentInternalId, { photo_uri: null });
}

/* read a student's stored photo URI (central registry) */
export async function getStudentPhoto(studentInternalId) {
  const s = await getStudentByInternalId(studentInternalId);
  return (s && s.photo_uri) || null;
}
