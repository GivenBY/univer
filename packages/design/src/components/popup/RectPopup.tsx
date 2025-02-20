/**
 * Copyright 2023-present DreamNum Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useEvent } from 'rc-util';
import styles from './index.module.less';

interface IAbsolutePosition {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

const RectPopupContext = createContext({ top: 0, bottom: 0, left: 0, right: 0 });

export interface IRectPopupProps {
    children?: React.ReactNode;

    /**
     * the anchor element bounding rect
     */
    anchorRect: IAbsolutePosition;
    excludeRects?: IAbsolutePosition[];
    direction?: 'vertical' | 'horizontal' | 'left' | 'top' | 'right' | 'left' | 'bottom';

    // #region closing behavior

    closeOnSelfTarget?: boolean;
    onClickOutside?: (e: MouseEvent) => void;
    excludeOutside?: HTMLElement[];

    // #endregion
}

export interface IPopupLayoutInfo extends Pick<IRectPopupProps, 'direction'> {
    position: IAbsolutePosition;
    width: number;
    height: number;
    containerWidth: number;
    containerHeight: number;
}

/** The popup should have a minimum edge to the boundary. */
const PUSHING_MINIMUM_GAP = 8;

function calcPopupPosition(layout: IPopupLayoutInfo): { top: number; left: number } {
    const { position, width, height, containerHeight, containerWidth, direction = 'vertical' } = layout;

    // In y-axis
    if (direction === 'vertical' || direction === 'top' || direction === 'bottom') {
        const { left: startX, top: startY, right: endX, bottom: endY } = position;
        const verticalStyle = direction === 'top'
            // const verticalStyle = ((endY + height) > containerHeight || direction === 'top')
            ? { top: Math.max(startY - height, PUSHING_MINIMUM_GAP) }
            : { top: Math.min(endY, containerHeight - height - PUSHING_MINIMUM_GAP) };

        // If the popup element exceed the visible area. We should "push" it back.
        const horizontalStyle = (startX + width) > containerWidth
            ? { left: Math.max(endX - width, PUSHING_MINIMUM_GAP) } // on left
            : { left: Math.min(startX, containerWidth - width - PUSHING_MINIMUM_GAP) }; // on right

        return { ...verticalStyle, ...horizontalStyle };
    }

    // In x-axis
    const { left: startX, top: startY, right: endX, bottom: endY } = position;
    // const horizontalStyle = ((endX + width) > containerWidth || direction === 'left')
    const horizontalStyle = direction === 'left'
        ? { left: Math.max(startX - width, PUSHING_MINIMUM_GAP) } // on left
        : { left: Math.min(endX, containerWidth - width - PUSHING_MINIMUM_GAP) }; // on right

    // If the popup element exceed the visible area. We should "push" it back.
    const verticalStyle = ((startY + height) > containerHeight)
        ? { top: Math.max(endY - height, PUSHING_MINIMUM_GAP) } // on top
        : { top: Math.min(startY, containerHeight - height - PUSHING_MINIMUM_GAP) }; // on bottom

    return { ...verticalStyle, ...horizontalStyle };
};

function RectPopup(props: IRectPopupProps) {
    const { children, anchorRect, direction = 'vertical', onClickOutside, excludeOutside, excludeRects } = props;
    const nodeRef = useRef<HTMLElement>(null);
    const clickOtherFn = useEvent(onClickOutside ?? (() => { /* empty */ }));
    const [position, setPosition] = useState<Partial<IAbsolutePosition>>({
        top: -9999,
        left: -9999,
    });
    const excludeRectsRef = useRef(excludeRects);
    excludeRectsRef.current = excludeRects;

    const style = useMemo(() => ({ ...position }), [position]);
    useEffect(() => {
        requestAnimationFrame(() => {
            if (!nodeRef.current) return;

            const { clientWidth, clientHeight } = nodeRef.current;
            const innerWidth = window.innerWidth;
            const innerHeight = window.innerHeight;

            setPosition(calcPopupPosition(
                {
                    position: anchorRect,
                    width: clientWidth,
                    height: clientHeight,
                    containerWidth: innerWidth,
                    containerHeight: innerHeight,
                    direction,
                }
            ));
        });
    },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    [
        anchorRect.left,
        anchorRect.top,
        anchorRect.bottom,
        anchorRect.right,
        direction,
    ]);

    useEffect(() => {
        const handleClickOther = (e: MouseEvent) => {
            if (
                excludeOutside &&
                (
                    (excludeOutside.indexOf(e.target as any) > -1) ||
                    excludeOutside.some((item) => item.contains(e.target as any)
                    )
                )
            ) {
                return;
            }
            const x = e.offsetX;
            const y = e.offsetY;
            const rects = [anchorRect, ...excludeRectsRef.current ?? []];
            for (const rect of rects) {
                if (x <= rect.right && x >= rect.left && y <= rect.bottom && y >= rect.top) {
                    return;
                }
            }

            clickOtherFn(e);
        };

        window.addEventListener('pointerdown', handleClickOther);
        return () => window.removeEventListener('pointerdown', handleClickOther);
    }, [anchorRect, anchorRect.bottom, anchorRect.left, anchorRect.right, anchorRect.top, clickOtherFn, excludeOutside]);

    return (
        <section
            ref={nodeRef}
            style={style}
            className={styles.popupAbsolute}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <RectPopupContext.Provider value={anchorRect}>
                {children}
            </RectPopupContext.Provider>
        </section>
    );
}

RectPopup.calcPopupPosition = calcPopupPosition;

RectPopup.useContext = () => useContext(RectPopupContext);

export { RectPopup };
