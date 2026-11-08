import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

// รายการที่ลากเรียงได้ (ใช้ pointer events จึงใช้ได้ทั้งเมาส์และนิ้วบนมือถือ)
// จับที่ปุ่ม ⋮⋮ แล้วลาก หรือกดปุ่มนั้นแล้วใช้ลูกศรขึ้น/ลง

type Props<T> = {
  items: T[];
  getId: (item: T) => number;
  getLabel: (item: T) => string;
  onReorder: (ids: number[]) => void;
  render: (item: T, handle: ReactNode) => ReactNode;
  className?: string;
};

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function Sortable<T>({ items, getId, getLabel, onReorder, render, className }: Props<T>) {
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<number | null>(null);
  const refs = useRef(new Map<number, HTMLLIElement>());
  const startIds = useRef<number[]>([]);

  useEffect(() => {
    if (dragId === null) setOrder(items);
  }, [items, dragId]);

  const commit = (next: T[]) => {
    const ids = next.map(getId);
    if (ids.join() !== items.map(getId).join()) onReorder(ids);
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startIds.current = order.map(getId);
    setDragId(id);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragId === null) return;
    const from = order.findIndex((x) => getId(x) === dragId);
    let to = from;
    order.forEach((x, i) => {
      const el = refs.current.get(getId(x));
      if (!el || i === from) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (i < from && e.clientY < mid) to = Math.min(to, i);
      if (i > from && e.clientY > mid) to = Math.max(to, i);
    });
    if (to !== from) setOrder(move(order, from, to));
  };

  const onPointerUp = () => {
    if (dragId === null) return;
    setDragId(null);
    commit(order);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : -1;
    if (to < 0 || to >= order.length) return;
    e.preventDefault();
    const next = move(order, index, to);
    setOrder(next);
    commit(next);
    // คงโฟกัสที่ปุ่มจับของรายการเดิม
    requestAnimationFrame(() => refs.current.get(getId(order[index]))?.querySelector<HTMLButtonElement>(".ph-handle")?.focus());
  };

  return (
    <ul className={`ph-sortable ${className ?? ""}`}>
      {order.map((item, i) => {
        const id = getId(item);
        const handle = (
          <button
            type="button"
            className="ph-handle"
            aria-label={`ย้าย ${getLabel(item)} (ลากหรือใช้ลูกศรขึ้น/ลง)`}
            onPointerDown={(e) => onPointerDown(e, id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            ⋮⋮
          </button>
        );
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) refs.current.set(id, el);
              else refs.current.delete(id);
            }}
            className={dragId === id ? "is-dragging" : undefined}
          >
            {render(item, handle)}
          </li>
        );
      })}
    </ul>
  );
}
