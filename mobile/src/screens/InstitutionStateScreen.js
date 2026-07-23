import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import Card from '../components/Card';
import Logo from '../components/Logo';
import Icon from '../components/Icon';

export default function InstitutionStateScreen({ kind = 'error', onRetry, onSignOut }) {
  const { c } = useTheme();
  const [retrying, setRetrying] = useState(false);
  const unclassified = kind === 'unclassified';
  const retry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try { await onRetry(); } catch (e) { /* AuthContext retains the safe state. */ }
    finally { setRetrying(false); }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.wrap}>
        <Logo size={46} />
        <Card style={styles.card}>
          <View style={[styles.icon, { backgroundColor: unclassified ? c.goldSoft : c.roseSoft }]}>
            <Icon name={unclassified ? 'building' : 'notice'} size={24} color={unclassified ? c.gold700 : c.rose} />
          </View>
          <Text style={[styles.title, { color: c.ink }]}>{unclassified ? 'Nooca hay’adda lama qeexin' : 'Xogta hay’adda lama soo dejin karin'}</Text>
          <Text style={[styles.sub, { color: c.muted }]}>
            {unclassified
              ? 'Akoonkan wuxuu ku xiran yahay hay’ad legacy ah oo aan weli loo kala saarin Dugsi ama Jaamacad. Lama qiyaasi doono nooca hay’adda.'
              : 'Waxaan joojinay gelitaanka si aanan kuu tusin qayb khaldan. Hubi xiriirka kadibna isku day mar kale.'}
          </Text>
          {onRetry ? <TouchableOpacity onPress={retry} disabled={retrying} style={[styles.primary, { backgroundColor: c.blue }]}>
            {retrying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Isku day mar kale</Text>}
          </TouchableOpacity> : null}
          {onSignOut ? <TouchableOpacity onPress={onSignOut} style={[styles.secondary, { borderColor: c.line }]}>
            <Text style={[styles.secondaryTxt, { color: c.ink2 }]}>Ka bax akoonka</Text>
          </TouchableOpacity> : null}
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, wrap: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', padding: 20, alignItems: 'center' },
  card: { width: '100%', marginTop: 18, alignItems: 'center', paddingVertical: 28 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  sub: { fontSize: 13, fontWeight: '600', lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 390 },
  primary: { width: '100%', height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  secondary: { width: '100%', height: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryTxt: { fontSize: 14, fontWeight: '700' },
});
