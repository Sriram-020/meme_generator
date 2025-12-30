import { useState, useRef, useEffect } from 'react';

export const ResizableImage = ({
    id,
    src,
    initialX,
    initialY,
    initialWidth,
    initialHeight,
    initialRotate,
    isSelected,
    onSelect,
    onChange,
    onRemove
}) => {
    const [rect, setRect] = useState({
        x: initialX,
        y: initialY,
        width: initialWidth,
        height: initialHeight,
        rotate: initialRotate
    });

    // Update internal state if props change externally (e.g. reset)
    useEffect(() => {
        setRect({ x: initialX, y: initialY, width: initialWidth, height: initialHeight, rotate: initialRotate });
    }, [initialX, initialY, initialWidth, initialHeight, initialRotate]);

    const elementRef = useRef(null);
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const isRotating = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startRect = useRef({ x: 0, y: 0, width: 0, height: 0, rotate: 0 });
    const interactionRect = useRef(null); // Fix for stale closure in mouseUp
    const activeHandle = useRef(null);

    // --- DRAG (MOVE) ---
    const handleMouseDown = (e) => {
        if (e.target.closest('.resize-handle') || e.target.closest('.rotate-handle')) return;

        e.preventDefault();
        e.stopPropagation();
        onSelect(id);

        isDragging.current = true;
        startPos.current = { x: e.clientX, y: e.clientY };
        startRect.current = { ...rect };
        interactionRect.current = { ...rect }; // Init interaction rect

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // --- RESIZE ---
    const handleResizeStart = (e, handle) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing.current = true;
        activeHandle.current = handle;
        startPos.current = { x: e.clientX, y: e.clientY };
        startRect.current = { ...rect };
        interactionRect.current = { ...rect };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // --- ROTATE ---
    const handleRotateStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isRotating.current = true;

        // Calculate center for rotation
        const box = elementRef.current.getBoundingClientRect();
        const center = {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2
        };
        startPos.current = center; // Use startPos to store center
        startRect.current = { ...rect };
        interactionRect.current = { ...rect };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (isDragging.current) {
            const dx = e.clientX - startPos.current.x;
            const dy = e.clientY - startPos.current.y;
            const newRect = {
                ...rect, // Note: spreading 'rect' here is technically using stale state for unchanging props, effectively fine as they don't change
                x: startRect.current.x + dx,
                y: startRect.current.y + dy
            };
            setRect(newRect);
            interactionRect.current = newRect;
        }
        else if (isResizing.current) {
            const dx = e.clientX - startPos.current.x;
            const dy = e.clientY - startPos.current.y;
            const handle = activeHandle.current;

            let newW = startRect.current.width;
            let newH = startRect.current.height;
            let newX = startRect.current.x;
            let newY = startRect.current.y;

            if (handle.includes('e')) newW = startRect.current.width + dx;
            if (handle.includes('w')) {
                newW = startRect.current.width - dx;
                newX = startRect.current.x + dx;
            }
            if (handle.includes('s')) newH = startRect.current.height + dy;
            if (handle.includes('n')) {
                newH = startRect.current.height - dy;
                newY = startRect.current.y + dy;
            }

            // Constrain min size
            if (newW < 20) newW = 20;
            if (newH < 20) newH = 20;

            const newRect = { ...rect, x: newX, y: newY, width: newW, height: newH };
            setRect(newRect);
            interactionRect.current = newRect;
        }
        else if (isRotating.current) {
            const center = startPos.current;
            const dx = e.clientX - center.x;
            const dy = e.clientY - center.y;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            const newRect = { ...rect, rotate: angle + 90 };
            setRect(newRect);
            interactionRect.current = newRect;
        }
    };

    const handleMouseUp = () => {
        if (isDragging.current || isResizing.current || isRotating.current) {
            // Use the interaction rect if available, or fallback to current state (though state is stale in closure!)
            // Actually, if interactionRect is set, it's the latest.
            if (interactionRect.current) {
                onChange(interactionRect.current);
            }
        }
        isDragging.current = false;
        isResizing.current = false;
        isRotating.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    const styles = {
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        transform: `rotate(${rect.rotate}deg)`,
        transformOrigin: 'center center',
        cursor: isSelected ? 'move' : 'pointer',
        border: isSelected ? '2px solid #00a8ff' : '1px dashed transparent',
        boxSizing: 'border-box',
        zIndex: isSelected ? 10 : 1, // lowered mainly to keep text visible, but "bring to front" on select is common
        pointerEvents: 'auto'
    };

    return (
        <div ref={elementRef} style={styles} onMouseDown={handleMouseDown}>
            <img src={src} style={{ width: '100%', height: '100%', pointerEvents: 'none', objectFit: 'fill' }} />

            {isSelected && (
                <>
                    {/* Corners */}
                    {['nw', 'ne', 'sw', 'se'].map(h => (
                        <div
                            key={h}
                            className={`resize-handle ${h}`}
                            onMouseDown={(e) => handleResizeStart(e, h)}
                            style={{
                                position: 'absolute',
                                width: 10, height: 10,
                                background: 'white',
                                border: '1px solid #00a8ff',
                                borderRadius: '50%',
                                zIndex: 101,
                                top: h.includes('n') ? -6 : 'auto',
                                bottom: h.includes('s') ? -6 : 'auto',
                                left: h.includes('w') ? -6 : 'auto',
                                right: h.includes('e') ? -6 : 'auto',
                                cursor: `${h}-resize`
                            }}
                        />
                    ))}

                    {/* Rotate Handle */}
                    <div
                        className="rotate-handle"
                        onMouseDown={handleRotateStart}
                        style={{
                            position: 'absolute',
                            top: -25, left: '50%', marginLeft: -5,
                            width: 10, height: 10,
                            background: '#00a8ff',
                            borderRadius: '50%',
                            cursor: 'grab'
                        }}
                    >
                        <div style={{ position: 'absolute', height: 15, width: 2, background: '#00a8ff', top: 10, left: 4 }}></div>
                    </div>

                    {/* Delete Handle */}
                    <div
                        onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }}
                        style={{
                            position: 'absolute',
                            top: -15, right: -15,
                            width: 20, height: 20,
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 'bold',
                            zIndex: 102,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                        title="Remove Image"
                    >
                        ×
                    </div>
                </>
            )}
        </div>
    );
};
