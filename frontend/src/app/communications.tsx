import { MessageSquare } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function CommunicationsScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Outreach"
      title="Communications"
      description="SMS/voice reminder history and call logs."
      icon={MessageSquare}
    />
  );
}
