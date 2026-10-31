import { useRef, useState } from 'react';
import { input } from '../world/worldStore';

/** 觸控虛擬搖桿（左下角） */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const R = 46;

  const move = (cx: number, cy: number) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ x: dx, y: dy });
    input.joyX = dx / R;
    input.joyZ = -dy / R;
  };
  const end = () => {
    id.current = null;
    setKnob({ x: 0, y: 0 });
    input.joyX = 0;
    input.joyZ = 0;
  };

  return (
    <div
      ref={base}
      className="pointer-events-auto relative h-32 w-32 touch-none select-none rounded-full border border-white/70 bg-white/35 shadow-soft backdrop-blur-sm"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (id.current === e.pointerId) move(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="移動搖桿"
      role="application"
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/90 shadow"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
