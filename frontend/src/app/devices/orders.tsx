import { Truck } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function DeviceOrdersScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Logistics"
      title="Device Orders"
      description="Shipping, activation, and reassignment pipeline."
      icon={Truck}
    />
  );
}
