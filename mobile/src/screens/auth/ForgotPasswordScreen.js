import React from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import Logo from '../../components/Logo';
import AuthForgotPasswordPanel from '../../components/AuthForgotPasswordPanel';

/* Real role-aware recovery screen. Staff uses email. Student and Parent use
   the WhatsApp verification workflows required by Kobciye. */
export default function ForgotPasswordScreen({ goLogin, initialMethod = 'staff' }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}> 
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.wrap}>
            <View style={styles.logo}><Logo size={44} /></View>
            <View style={[styles.card, { backgroundColor: c.surface }]}> 
              <AuthForgotPasswordPanel initialMethod={initialMethod} onBack={goLogin} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 32 },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  logo: { alignItems: 'center', marginBottom: 18 },
  card: { borderRadius: 22, padding: 22, ...(Platform.OS === 'web' ? { boxShadow: '0 18px 48px rgba(20,40,80,0.10)' } : { elevation: 4 }) },
});
