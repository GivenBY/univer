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

import type { ICellDataForSheetInterceptor, ICommandInfo, IRange, Nullable, Workbook } from '@univerjs/core';
import {
    ColorKit,
    Disposable,
    ICommandService,
    ObjectMatrix,
    ThemeService,
    toDisposable,
} from '@univerjs/core';
import {
    ErrorType,
    FormulaDataModel,
    SetArrayFormulaDataMutation,
    SetFormulaCalculationResultMutation,
} from '@univerjs/engine-formula';
import type { IRenderContext, IRenderModule } from '@univerjs/engine-render';
import { IRenderManagerService } from '@univerjs/engine-render';
import {
    IEditorBridgeService,
    ISheetSelectionRenderService,
    SelectionShape,
    SheetSkeletonManagerService,
} from '@univerjs/sheets-ui';
import { Inject } from '@wendellhu/redi';

export class FormulaEditorShowController extends Disposable implements IRenderModule {
    private _previousShape: Nullable<SelectionShape>;

    constructor(
        private readonly _context: IRenderContext<Workbook>,
        @Inject(IEditorBridgeService) private _editorBridgeService: IEditorBridgeService,
        @Inject(FormulaDataModel) private readonly _formulaDataModel: FormulaDataModel,
        @Inject(ThemeService) private readonly _themeService: ThemeService,
        @IRenderManagerService private readonly _renderManagerService: IRenderManagerService,
        @Inject(SheetSkeletonManagerService) private readonly _sheetSkeletonManagerService: SheetSkeletonManagerService,
        @ICommandService private readonly _commandService: ICommandService
    ) {
        super();
        this._initInterceptorEditorStart();

        this._commandExecutedListener();

        // Do not intercept v:null and add t: CellValueType.NUMBER. When the cell =TODAY() is automatically filled, the number format will recognize the Number type and parse it as 1900-01-00 date format.
    }

    private _initInterceptorEditorStart() {
        this.disposeWithMe(
            toDisposable(
                this._editorBridgeService.interceptor.intercept(
                    this._editorBridgeService.interceptor.getInterceptPoints().BEFORE_CELL_EDIT,
                    {
                        handler: (value, context, next) => {
                            const { row, col, unitId, subUnitId, worksheet } = context;
                            const arrayFormulaMatrixRange = this._formulaDataModel.getArrayFormulaRange();

                            const arrayFormulaMatrixCell = this._formulaDataModel.getArrayFormulaCellData();

                            this._removeArrayFormulaRangeShape();

                            if (value == null) {
                                return next(value);
                            }

                            let cellInfo: Nullable<ICellDataForSheetInterceptor> = null;

                            const formulaString = this._formulaDataModel.getFormulaStringByCell(row, col, subUnitId, unitId);

                            if (formulaString !== null) {
                                cellInfo = { f: formulaString };
                            }

                            /**
                             * If the display conditions for the array formula are not met, return the range directly.
                             */
                            if (
                                value.v != null &&
                                value.v !== '' &&
                                arrayFormulaMatrixCell[unitId]?.[subUnitId]?.[row]?.[col] == null
                            ) {
                                if (cellInfo) {
                                    return { ...value, ...cellInfo };
                                }

                                return next(value);
                            }

                            /**
                             * Mark the array formula for special display in subsequent processing
                             */
                            const matrixRange = arrayFormulaMatrixRange?.[unitId]?.[subUnitId];
                            if (matrixRange != null) {
                                new ObjectMatrix(matrixRange).forValue((rowIndex, columnIndex, range) => {
                                    if (range == null) {
                                        return true;
                                    }
                                    const { startRow, startColumn, endRow, endColumn } = range;
                                    if (rowIndex === row && columnIndex === col) {
                                        this._createArrayFormulaRangeShape(range, unitId);
                                        return false;
                                    }
                                    if (row >= startRow && row <= endRow && col >= startColumn && col <= endColumn) {
                                        const mainCellValue = worksheet.getCell(startRow, startColumn);

                                        if (mainCellValue?.v === ErrorType.SPILL) {
                                            return;
                                        }

                                        const formulaDataItem = this._formulaDataModel.getFormulaDataItem(
                                            rowIndex,
                                            columnIndex,
                                            subUnitId,
                                            unitId
                                        );

                                        if (formulaDataItem == null || formulaDataItem.f == null) {
                                            return true;
                                        }

                                        if (cellInfo == null) {
                                            cellInfo = {
                                                f: formulaDataItem.f,
                                                isInArrayFormulaRange: true,
                                            };
                                        }

                                        this._createArrayFormulaRangeShape(range, unitId);
                                        return false;
                                    }
                                });
                            }

                            if (cellInfo) {
                                return { ...value, ...cellInfo };
                            }

                            return next(value);
                        },
                    }
                )
            )
        );
    }

    private _commandExecutedListener() {
        this.disposeWithMe(this._commandService.onCommandExecuted((command: ICommandInfo, options) => {
            if (command.id === SetFormulaCalculationResultMutation.id || (command.id === SetArrayFormulaDataMutation.id && options && options.remove)
            ) {
                this._removeArrayFormulaRangeShape();
            }
        }));
    }

    private _createArrayFormulaRangeShape(arrayRange: IRange, unitId: string) {
        const styleSheet = this._themeService.getCurrentTheme();
        const fill = new ColorKit(styleSheet.colorWhite).setAlpha(0).toString();
        const style = {
            strokeWidth: 1,
            stroke: styleSheet.hyacinth700,
            fill,
            widgets: {},

            hasAutoFill: false,

            hasRowHeader: false,

            hasColumnHeader: false,
        };

        const renderUnit = this._renderManagerService.getRenderById(unitId);
        if (!renderUnit) return;

        const { scene } = renderUnit;
        const { rangeWithCoord, primaryWithCoord } = renderUnit.with(ISheetSelectionRenderService).attachSelectionWithCoord({
            range: arrayRange,
            primary: null,
            style,
        });
        const skeleton = this._sheetSkeletonManagerService.getCurrent()?.skeleton;
        if (!scene || !skeleton) return;
        const { rowHeaderWidth, columnHeaderHeight } = skeleton;
        const control = new SelectionShape(scene, 100, false, this._themeService);
        control.update(rangeWithCoord, rowHeaderWidth, columnHeaderHeight, style, primaryWithCoord);
        control.setEvent(false);
        this._previousShape = control;
    }

    private _removeArrayFormulaRangeShape() {
        if (this._previousShape == null) {
            return;
        }
        this._previousShape.dispose();
        this._previousShape = null;
    }
}
