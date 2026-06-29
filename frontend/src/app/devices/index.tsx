import { Cpu } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function DevicesScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Inventory"
      title="Devices"
      description="BP monitors, glucometers, scales, pulse ox, and gateways across all clinics."
      icon={Cpu}
    />
  );
}
