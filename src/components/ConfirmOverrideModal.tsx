import { useAtom } from 'jotai';
import { confirmOverrideDataCallbackAtom } from '../atoms/firebaseUserAtoms';
import ConfirmationModal from './ConfirmationModal';

export default function ConfirmOverrideModal() {
  const [confirmOverrideDataCallback, setConfirmOverrideDataCallback] = useAtom(
    confirmOverrideDataCallbackAtom
  );

  return (
    <ConfirmationModal
      isOpen={!!confirmOverrideDataCallback}
      title="Override local data?"
      description="Your local data will be overwritten by your server data."
      confirmLabel="Override data"
      onConfirm={() => {
        void confirmOverrideDataCallback?.().then(() =>
          setConfirmOverrideDataCallback(null)
        );
      }}
      onClose={() => setConfirmOverrideDataCallback(null)}
    />
  );
}
