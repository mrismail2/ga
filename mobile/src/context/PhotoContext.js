/* Stores profile photos keyed by person code (student/teacher) and
   exposes a cross-platform picker.

   IMPORTANT: expo-image-picker is NOT imported statically — on web that
   crashes at load. Instead we use an HTML file input on web, and lazily
   require expo-image-picker only on native. */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PhotoContext = createContext({ photos: {}, pickPhoto: async () => {}, setPhoto: () => {}, removePhoto: () => {} });
const KEY = 'kobciye_photos';

// Web: open a file dialog and resolve a data-URI.
function pickWeb() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

// Native: lazily load expo-image-picker so web never touches it.
async function pickNative() {
  try {
    const ImagePicker = require('expo-image-picker');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled && res.assets && res.assets[0]) return res.assets[0].uri;
  } catch (e) { /* ignore — prototype */ }
  return null;
}

export function PhotoProvider({ children }) {
  const [photos, setPhotos] = useState({});

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) { try { setPhotos(JSON.parse(v)); } catch (e) {} }
    });
  }, []);

  const persist = useCallback((next) => {
    setPhotos(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setPhoto = useCallback((code, uri) => {
    setPhotos((prev) => {
      const next = { ...prev, [code]: uri };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const pickPhoto = useCallback(async (code) => {
    const uri = Platform.OS === 'web' ? await pickWeb() : await pickNative();
    if (uri) setPhoto(code, uri);
    return uri;
  }, [setPhoto]);

  // clear the cached photo for one or more keys (live display update)
  const removePhoto = useCallback((...keys) => {
    setPhotos((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { if (k) delete next[k]; });
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <PhotoContext.Provider value={{ photos, pickPhoto, setPhoto, removePhoto }}>
      {children}
    </PhotoContext.Provider>
  );
}

export const usePhotos = () => useContext(PhotoContext);
