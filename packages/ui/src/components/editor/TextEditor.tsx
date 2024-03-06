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

import { debounce, type IDocumentData, LocaleService, type Nullable } from '@univerjs/core';
import { useDependency } from '@wendellhu/redi/react-bindings';
import React, { useEffect, useRef, useState } from 'react';
import { Popup } from '@univerjs/design';
import type { IEditorCanvasStyle } from '../../services/editor/editor.service';
import { IEditorService } from '../../services/editor/editor.service';
import styles from './index.module.less';

type MyComponentProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

const excludeProps = new Set([
    'snapshot',
    'resizeCallBack',
    'cancelDefaultResizeListener',
    'isSheetEditor',
    'canvasStyle',
    'isSingle',
    'isReadonly',
    'onlyInputFormula',
    'onlyInputRange',
    'value',
    'onlyInputContent',
    'openForSheetUnitId',
    'openForSheetSubUnitId',
    'onChange',
    'onFocus',
    'onValid',
]);

export interface ITextEditorProps {
    id: string; // unitId
    className?: string; // Parent class name.

    snapshot?: IDocumentData; // The default initialization snapshot for the editor can be simply replaced with the value attribute, for cellEditor and formulaBar

    resizeCallBack?: (editor: Nullable<HTMLDivElement>) => void; // Container scale callback.

    cancelDefaultResizeListener?: boolean; // Disable the default container scaling listener, for cellEditor and formulaBar

    isSheetEditor?: boolean; // Specify whether the editor is bound to a sheet. Currently, there are cellEditor and formulaBar.

    canvasStyle?: IEditorCanvasStyle; // Setting the style of the editor is similar to setting the drawing style of a canvas, and therefore, it should be distinguished from the CSS 'style'. At present, it only supports the 'fontsize' attribute.

    value?: string; // default values.

    isSingle?: boolean; // Set whether the editor allows multiline input, default is true, equivalent to input; false is equivalent to textarea.
    isReadonly?: boolean; // Set the editor to read-only state.

    onlyInputFormula?: boolean; // Only input formula string
    onlyInputRange?: boolean; // Only input ref range
    onlyInputContent?: boolean; // Only plain content can be entered, turning off formula and range input highlighting.

    openForSheetUnitId?: Nullable<string>; //  Configuring which workbook the selector defaults to opening in determines whether the ref includes a [unitId] prefix.
    openForSheetSubUnitId?: Nullable<string>; // Configuring the default worksheet where the selector opens determines whether the ref includes a [unitId]sheet1 prefix.

    onChange?: (value: Nullable<string>) => void; // Callback for changes in the selector value.

    onFocus?: (state: boolean) => void; // Callback for editor focus.

    onValid?: (state: boolean) => void; // Editor input value validation, currently effective only under onlyRange and onlyFormula conditions.

}

/**
 * The component to render toolbar item label and menu item label.
 * @param props
 */
export function TextEditor(props: ITextEditorProps & Omit<MyComponentProps, 'onChange' | 'onFocus'>): JSX.Element | null {
    const {
        id,
        snapshot,
        resizeCallBack,
        cancelDefaultResizeListener,
        isSheetEditor = false,
        canvasStyle = {},
        value,
        isSingle = true,
        isReadonly = false,
        onlyInputFormula = false,
        onlyInputRange = false,
        onlyInputContent = false,

        openForSheetUnitId,
        openForSheetSubUnitId,

        onChange,

        onFocus,

        onValid,
    } = props;

    const editorService = useDependency(IEditorService);

    const localeService = useDependency(LocaleService);

    const [validationContent, setValidationContent] = useState<string>('');

    const [validationVisible, setValidationVisible] = useState(false);

    const [validationOffset, setValidationOffset] = useState<[number, number]>([0, 0]);

    const editorRef = useRef<HTMLDivElement>(null);

    const [active, setActive] = useState(false);

    useEffect(() => {
        const editor = editorRef.current;

        if (!editor) {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            if (cancelDefaultResizeListener !== true) {
                editorService.resize(id);
            }
            resizeCallBack && resizeCallBack(editor);
        });

        resizeObserver.observe(editor);

        const registerSubscription = editorService.register({
            editorUnitId: id,
            initialSnapshot: snapshot,
            cancelDefaultResizeListener,
            isSheetEditor,
            canvasStyle,
            isSingle,
            isReadonly,
            onlyInputFormula,
            onlyInputRange,
            onlyInputContent,
            openForSheetUnitId,
            openForSheetSubUnitId,
        },
        editor);

        const focusStyleSubscription = editorService.focusStyle$.subscribe((unitId: Nullable<string>) => {
            let state = false;
            if (unitId === id) {
                state = true;
            }
            setActive(state);
            onFocus && onFocus(state);
        });

        const valueChangeSubscription = editorService.valueChange$.subscribe((editor) => {
            if (!editor.onlyInputFormula() && !editor.onlyInputRange()) {
                return;
            }

            if (editor.editorUnitId !== id) {
                return;
            }

            debounce(() => {
                const unitId = editor.editorUnitId;
                const isLegality = editorService.checkValueLegality(unitId);
                setValidationVisible(!isLegality);
                const rect = editor.getBoundingClientRect();

                setValidationOffset([rect.left, rect.top - 16]);

                if (editor.onlyInputFormula()) {
                    setValidationContent(localeService.t('textEditor.formulaError'));
                } else {
                    setValidationContent(localeService.t('textEditor.rangeError'));
                }

                onValid && onValid(isLegality);

                onChange && onChange(editorService.getValue(id));
            }, 10)();
        });

        // Clean up on unmount
        return () => {
            resizeObserver.unobserve(editor);

            registerSubscription.dispose();

            focusStyleSubscription?.unsubscribe();

            valueChangeSubscription?.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (value == null) {
            return;
        }
        editorService.setValue(value, id);
    }, [value]);

    const propsNew = Object.fromEntries(
        Object.entries(props).filter(([key]) => !excludeProps.has(key))
    );

    let className = styles.textEditorContainer;
    if (props.className != null) {
        className = props.className;
    }

    let borderStyle = '';

    if (active && props.className == null) {
        if (validationVisible) {
            borderStyle = ` ${styles.textEditorContainerError}`;
        } else {
            borderStyle = ` ${styles.textEditorContainerActive}`;
        }
    }

    return (
        <>
            <div {...propsNew} className={className + borderStyle} ref={editorRef}></div>
            <Popup visible={validationVisible} offset={validationOffset}>
                <div className={styles.textEditorValidationError}>{validationContent}</div>
            </Popup>
        </>
    );
}