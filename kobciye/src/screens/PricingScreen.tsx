import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';
import { PrimaryButton } from '../components/PrimaryButton';

type Props = { navigation: NativeStackNavigationProp<any> };

const plans = [
  {
    name: 'Starter',
    nameSo: 'Bilowga',
    monthlyPrice: '$29',
    yearlyPrice: '$290',
    color: Colors.blue,
    features: ['Up to 200 students', '5 teacher accounts', 'Attendance & Payments', 'Basic Reports'],
  },
  {
    name: 'School',
    nameSo: 'Dugsi',
    monthlyPrice: '$79',
    yearlyPrice: '$790',
    color: Colors.navy,
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited students',
      'Unlimited teachers',
      'Full module access',
      'Student Incidents module',
      'Parent portal',
      'Advanced Reports',
    ],
  },
  {
    name: 'Enterprise',
    nameSo: 'Ganacsiga',
    monthlyPrice: '$199',
    yearlyPrice: '$1,990',
    color: Colors.gold700,
    features: [
      'Multi-school management',
      'Custom branding',
      'API access',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
];

export const PricingScreen: React.FC<Props> = ({ navigation }) => {
  const [yearly, setYearly] = useState(false);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Simple, Transparent Pricing</Text>
        <Text style={styles.titleSo}>Qiimaha Fudud oo Cad</Text>

        {/* Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            onPress={() => setYearly(false)}
            style={[styles.toggleBtn, !yearly && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, !yearly && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setYearly(true)}
            style={[styles.toggleBtn, yearly && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, yearly && styles.toggleTextActive]}>Yearly</Text>
          </TouchableOpacity>
        </View>
        {yearly && <Text style={styles.savingText}>💚 Save ~17% with yearly billing</Text>}
      </View>

      {plans.map((plan, i) => (
        <View
          key={i}
          style={[styles.card, plan.highlight && { borderColor: plan.color, borderWidth: 2 }]}
        >
          {plan.badge && (
            <View style={[styles.badge, { backgroundColor: plan.color }]}>
              <Text style={styles.badgeText}>{plan.badge}</Text>
            </View>
          )}
          <View style={[styles.planHeader, { backgroundColor: plan.color + '12' }]}>
            <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
            <Text style={styles.planNameSo}>{plan.nameSo}</Text>
            <Text style={[styles.price, { color: plan.color }]}>
              {yearly ? plan.yearlyPrice : plan.monthlyPrice}
            </Text>
            <Text style={styles.pricePer}>{yearly ? '/year' : '/month'}</Text>
          </View>
          <View style={styles.features}>
            {plan.features.map((f, j) => (
              <View key={j} style={styles.featureRow}>
                <Text style={[styles.check, { color: plan.color }]}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <PrimaryButton
            label="Choose Plan"
            onPress={() => navigation.navigate('RegisterSchool')}
            color={plan.color}
            style={styles.choosBtn}
          />
        </View>
      ))}

      <Text style={styles.note}>
        * Pricing is indicative for Phase 1 UI preview. Final pricing will be confirmed at launch.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48 },
  header: {
    padding: 24,
    paddingTop: 52,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    marginBottom: 4,
  },
  back: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: Colors.navy300, fontSize: 22, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.surface, textAlign: 'center', marginBottom: 2 },
  titleSo: { fontSize: 13, color: Colors.gold, marginBottom: 20 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.navy600,
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  toggleActive: { backgroundColor: Colors.surface },
  toggleText: { color: Colors.navy300, fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: Colors.navy, fontWeight: '700' },
  savingText: { color: Colors.gold, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    margin: 16,
    marginBottom: 4,
    overflow: 'hidden',
    ...Shadows.md,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    borderRadius: 20,
    marginTop: 14,
  },
  badgeText: { color: Colors.surface, fontWeight: '700', fontSize: 11 },
  planHeader: {
    padding: 20,
    alignItems: 'center',
  },
  planName: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  planNameSo: { fontSize: 12, color: Colors.muted, marginBottom: 10 },
  price: { fontSize: 36, fontWeight: '900' },
  pricePer: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  features: { padding: 20, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { fontSize: 15, fontWeight: '700' },
  featureText: { fontSize: 14, color: Colors.text2 },
  choosBtn: { margin: 16, marginTop: 4 },
  note: {
    fontSize: 11,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 12,
    lineHeight: 16,
  },
});
