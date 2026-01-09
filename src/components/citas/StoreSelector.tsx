/**
 * Selector de tienda para filtrar citas históricas
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StoreSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  stores: string[];
}

export function StoreSelector({ value, onValueChange, stores }: StoreSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Todas las tiendas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas las tiendas</SelectItem>
        {stores.map((store) => (
          <SelectItem key={store} value={store}>
            {store}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

