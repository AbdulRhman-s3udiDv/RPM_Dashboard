import { GitBranch } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function WorkflowsScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Automation"
      title="Workflows"
      description="The 4 n8n agents (alerts, reminders, roster sync, review-time logging) and their run history."
      icon={GitBranch}
    />
  );
}
