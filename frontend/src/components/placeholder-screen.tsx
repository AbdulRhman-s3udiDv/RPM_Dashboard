import type { LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PageHeader } from '@/components/ui/page-header';
import { useTheme } from '@/hooks/use-theme';

export function PlaceholderScreen({
  eyebrow, title, description, icon: Icon, note,
}: { eyebrow: string; title: string; description: string; icon: LucideIcon; note?: string }) {
  const colors = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon size={28} color={colors.textSecondary} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {note ?? 'This screen is being ported from the web dashboard next.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  box: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  text: { fontSize: 13, textAlign: 'center' },
});
