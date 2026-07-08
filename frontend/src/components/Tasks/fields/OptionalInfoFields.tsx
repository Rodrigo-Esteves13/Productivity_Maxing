import Input from '../../UI/Input';

interface OptionalInfoFieldsProps {
  topics: string;
  referenceLink: string;
  onTopicsChange: (value: string) => void;
  onReferenceLinkChange: (value: string) => void;
}

export default function OptionalInfoFields({
  topics,
  referenceLink,
  onTopicsChange,
  onReferenceLinkChange,
}: OptionalInfoFieldsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-neutral-800">
      <p className="text-xs font-semibold text-neutral-500 uppercase">Optional Information</p>
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Topics"
          value={topics}
          onChange={(e) => onTopicsChange(e.target.value)}
          className="w-full"
        />
        <Input
          type="url"
          placeholder="Reference link"
          value={referenceLink}
          onChange={(e) => onReferenceLinkChange(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex items-start gap-2 pt-1">
        <input
          type="checkbox"
          disabled
          className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-violet-600 opacity-60 cursor-not-allowed"
        />
        <div>
          <span className="text-sm text-neutral-400">Add to Google Calendar</span>
          <p className="text-xs text-neutral-600">Will work in a future release.</p>
        </div>
      </div>
    </div>
  );
}
