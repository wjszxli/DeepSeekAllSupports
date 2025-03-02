import { useState, useRef, useCallback, RefObject } from 'react';

interface Position {
  x: number;
  y: number;
}

export function useDraggable(initialPosition: Position, ref: RefObject<HTMLElement>, isPinned: boolean = false) {
  const [position, setPosition] = useState(initialPosition);
  const isDragging = useRef(false);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPinned || !ref.current || e.target !== e.currentTarget) return;
    e.preventDefault();
    
    const el = ref.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = position.x;
    const startTop = position.y;
    
    isDragging.current = true;
    el.style.transition = 'none';
    el.classList.add('dragging');
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      // 直接修改DOM元素位置，而不是通过React状态更新
      el.style.left = `${startLeft + dx}px`;
      el.style.top = `${startTop + dy}px`;
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!isDragging.current) return;
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // 拖拽结束再更新React状态，避免频繁渲染
      const finalX = startLeft + (upEvent.clientX - startX);
      const finalY = startTop + (upEvent.clientY - startY);
      
      el.style.transition = '';
      el.classList.remove('dragging');
      isDragging.current = false;
      
      setPosition({ x: finalX, y: finalY });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, isPinned, ref]);
  
  return { position, setPosition, handleMouseDown };
} 