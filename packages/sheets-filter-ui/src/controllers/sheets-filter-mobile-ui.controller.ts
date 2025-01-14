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

import { LifecycleStages, runOnLifecycle, RxDisposable, UniverInstanceType } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
import type { Dependency } from '@wendellhu/redi';
import { SheetsFilterRenderController } from './sheets-filter-render.controller';

export class SheetsFilterMobileUIController extends RxDisposable {
    constructor(
        @IRenderManagerService private readonly _renderManagerService: IRenderManagerService
    ) {
        super();

        this._initRenderControllers();
    }

    private _initRenderControllers(): void {
        this.disposeWithMe(this._renderManagerService.registerRenderModule(UniverInstanceType.UNIVER_SHEET, [SheetsFilterRenderController] as Dependency));
    }
}

runOnLifecycle(LifecycleStages.Rendered, SheetsFilterMobileUIController);
