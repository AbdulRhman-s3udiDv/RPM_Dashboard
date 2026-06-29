import { BarChart3 } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AnalyticsScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Insights"
      title="Analytics"
      description="Compliance trends, staff productivity, and risk distribution."
      icon={BarChart3}
    />
  );
}
