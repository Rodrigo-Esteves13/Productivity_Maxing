import FormField from '../UI/FormField';

interface ColorPickerFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function ColorPickerField({ id, value, onChange, label = 'Cor Identificativa' }: ColorPickerFieldProps) {
  return (
    <FormField label={label} htmlFor={id}>
      <div className="flex items-center gap-4 bg-neutral-950 border border-neutral-700 rounded-md p-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
          {value}
        </span>
      </div>
    </FormField>
  );
}
