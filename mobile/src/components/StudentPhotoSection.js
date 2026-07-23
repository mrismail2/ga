import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { usePhotos } from '../context/PhotoContext';
import { avatarColors } from '../theme/colors';
import Icon from './Icon';
import LoadingDots from './LoadingDots';
import {
  pickStudentImageFromGallery, takeStudentPhotoWithCamera,
  saveStudentPhoto, removeStudentPhoto,
} from '../services/studentPhotoStorage';

function initials(name) {
  return String(name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/* Professional student profile-photo section for Add Student / Edit Profile.
   Only Super Admin / School Admin may capture, choose or remove a photo; any
   other role sees the photo read-only. The URI is stored locally only. */
export default function StudentPhotoSection({ student = {}, size = 96 }) {
  const { c } = useTheme();
  const { role } = useRole();
  const { photos, setPhoto, removePhoto } = usePhotos();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  // only admins may add/change/remove a student photo
  const canEdit = role === 'superadmin' || role === 'schooladmin';

  // store under every key the various Avatars use, so the photo shows everywhere
  const keys = [student.student_internal_id, student.student_id, student.name].filter(Boolean);
  const photo = keys.map((k) => photos[k]).find(Boolean) || student.photo_uri || null;
  const seedKey = keys[0] || 'student';
  const seed = String(seedKey).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const bg = avatarColors[seed % avatarColors.length];

  const apply = (uri) => {
    keys.forEach((k) => setPhoto(k, uri));
    saveStudentPhoto(student.student_internal_id, uri).catch(() => {});
  };

  const run = async (capture) => {
    setDenied(false); setBusy(true);
    try {
      const res = capture ? await takeStudentPhotoWithCamera() : await pickStudentImageFromGallery();
      if (res && res.denied) { setDenied(true); return; }
      if (res && res.uri) apply(res.uri);
    } finally { setBusy(false); }
  };

  const remove = () => {
    keys.forEach((k) => removePhoto(k));
    removeStudentPhoto(student.student_internal_id).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      {/* circular preview / placeholder */}
      <View style={[styles.ring, { borderColor: c.line, width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
            <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{student.name ? initials(student.name) : ''}</Text>
            {!student.name ? <Icon name="camera" size={size * 0.3} color="#fff" strokeWidth={1.8} /> : null}
          </View>
        )}
        {busy ? <View style={styles.busy}><LoadingDots color="#fff" size={7} gap={5} /></View> : null}
      </View>

      {!photo ? (
        <>
          <Text style={[styles.title, { color: c.ink }]}>Sawirka Ardayga</Text>
          <Text style={[styles.hint, { color: c.muted }]}>Ku dar sawir Camera ama Gallery</Text>
        </>
      ) : null}

      {canEdit ? (
        <View style={styles.btns}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: c.navy }]} onPress={() => run(true)} disabled={busy}>
            <Icon name="camera" size={15} color="#fff" strokeWidth={2} />
            <Text style={styles.btnTxt}>Ka Qaad Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: c.blue }]} onPress={() => run(false)} disabled={busy}>
            <Icon name="download" size={15} color="#fff" strokeWidth={2} />
            <Text style={styles.btnTxt}>Ka Door Gallery</Text>
          </TouchableOpacity>
          {photo ? (
            <TouchableOpacity style={[styles.btnGhost, { borderColor: c.rose }]} onPress={remove} disabled={busy}>
              <Icon name="trash" size={15} color={c.rose} strokeWidth={2} />
              <Text style={[styles.btnGhostTxt, { color: c.rose }]}>Ka Saar Sawirka</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {denied ? (
        <Text style={[styles.denied, { color: c.rose, backgroundColor: c.roseSoft }]}>
          Oggolaanshaha Camera ama Gallery lama siin. Fadlan Settings ka oggolow.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, marginBottom: 8 },
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '800' },
  busy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.25)', borderRadius: 999 },
  title: { fontSize: 14.5, fontWeight: '800', marginTop: 4 },
  hint: { fontSize: 12, fontWeight: '600' },
  btns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11 },
  btnTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  btnGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1.4 },
  btnGhostTxt: { fontSize: 12.5, fontWeight: '700' },
  denied: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17, padding: 9, borderRadius: 10, marginTop: 8 },
});
