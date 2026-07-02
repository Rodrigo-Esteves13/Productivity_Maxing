interface ProfileStatProps {
  label: string;
  value: string | number;
}

export default function ProfileStat({ label, value }: ProfileStatProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
      <p className="text-sm font-medium text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}