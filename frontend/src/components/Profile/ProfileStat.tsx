import Skeleton from '../UI/Skeleton';

interface ProfileStatProps {
  label: string;
  value: string | number;
  isLoading?: boolean;
}

export default function ProfileStat({ label, value, isLoading = false }: ProfileStatProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
      <p className="text-sm font-medium text-neutral-400">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-1.5 h-7 w-10 mx-auto" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      )}
    </div>
  );
}
