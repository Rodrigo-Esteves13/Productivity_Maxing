import type { InputHTMLAttributes } from 'react';

export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="border border-neutral-700 bg-neutral-900 text-white rounded p-2 placeholder:text-neutral-500"
      {...props}
    />
  );
}