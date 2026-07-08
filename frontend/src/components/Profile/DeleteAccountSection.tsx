interface DeleteAccountSectionProps {
  onOpen: () => void;
}

export default function DeleteAccountSection({ onOpen }: DeleteAccountSectionProps) {
  return (
    <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-6 max-w-3xl mt-8">
      <h3 className="text-red-400 font-semibold mb-1">Danger Zone</h3>
      <p className="text-neutral-400 text-sm mb-4">
        Deleting your account is permanent and cannot be undone. All your tasks, areas
        progress, and linked accounts will be removed.
      </p>
      <button
        onClick={onOpen}
        className="px-4 py-2 rounded-lg border border-red-900/60 text-red-400 text-sm font-medium hover:bg-red-950/40 transition-colors"
      >
        Delete account
      </button>
    </div>
  );
}
