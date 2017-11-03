(function($){
    var pluginCount = 0;

    var layoutHtml =
        '<div class="rs">' +
        '   <div class="rs__line">' +
        '       <div class="rs__handle-value rs__handle-value_from"><p>0</p><div></div></div>' +
        '       <div class="rs__handle-value rs__handle-value_to"><p>0</p><div></div></div>' +
        '       <div class="rs__handle-value rs__handle-value_single"><p>0</p><div></div></div>' +
        '       <div class="rs__field">' +
        '           <div class="rs__range"></div>' +
        '           <div class="rs__handle rs__handle_from"></div>' +
        '           <div class="rs__handle rs__handle_to"></div>' +
        '       </div>' +
        '   </div>' +
        '   <div class="rs__grid"></div>' +
        '</div>';

    var RangeSlider = function (objSlider, param, plugin_count) {
        this.pluginNamespace = 'dimkreativ_rs_'+plugin_count;
        this.is_dragging = false;
        this.is_active = false;
        this.is_click = false;
        this.is_grid = false;
        this.target = null;

        param = param || {};

        var grid_format_param       = param.grid_format || {},
            tooltip_format_param    = param.tooltip_format || {};

        this.options  = {
            // tooltip
            tooltip_set: param.tooltip_set || false,
            tooltip_value_format: {
                'decimals' : tooltip_format_param.decimals || 0,
                'dec_point' : ((typeof tooltip_format_param.dec_point !== 'undefined') ? tooltip_format_param.dec_point : ','),
                'thousands_sep' : ((typeof tooltip_format_param.thousands_sep !== 'undefined') ? tooltip_format_param.thousands_sep : ''),
                'prefix' : tooltip_format_param.prefix || '',
                'delimiter': ((typeof tooltip_format_param.delimiter !== 'undefined') ? tooltip_format_param.delimiter : ' — '),
                'callBack' : tooltip_format_param.callBack || null
            },
            // all
            min: param.min || 0,
            max: param.max || 100,
            step: param.step || 1,
            // grid
            grid_set: param.grid_set || false,
            grid_num: param.grid_num || 4,
            grid_labels: param.grid_labels || [],
            grid_labels_step: param.grid_labels_step || [],
            grid_value_set: ((typeof param.grid_value_set === 'boolean') ? param.grid_value_set : true),
            grid_value_format: {
                'decimals' : grid_format_param.decimals || 0,
                'dec_point' : ((typeof grid_format_param.dec_point !== 'undefined') ? grid_format_param.dec_point : ','),
                'thousands_sep' : ((typeof grid_format_param.thousands_sep !== 'undefined') ? grid_format_param.thousands_sep : ''),
                'prefix' : grid_format_param.prefix || '',
                'callBack' : grid_format_param.callBack || null
            },
            // callbacks functions
            onStart : param.onStart || null,
            onFinish : param.onFinish || null,
            onChange : param.onChange || null
        };

        this.coords = {
            x_pointer: 0,
            rs_left_offset: 0,
            w_rs: 0,
            w_bar: 0,
            // percent (в процентах)
            p_from: 0, // позиция
            p_to: 100,
            p_this: 0, // текущая позиция
            // grid
            grid_p_main_position: [],
            grid_p_position: []
        };

        // tooltip values
        this.tooltip = {
            tooltip_from_value: 0,
            tooltip_to_value: 0,
            tooltip_cur_value: 0
        };

        /**
         * jQquery cache object
         */
        this.$cache = {
            win: $(window),
            body: $(document.body),
            objSlider: $(objSlider),
            rs: null,
            from: null,
            to: null,
            bar: null,
            line: null,
            pointers: null,
            lastActivePointer: null,
            tooltip_from: null,
            tooltip_to: null,
            tooltip_single: null,
            grid: null
        };

        this.init();
    };

    RangeSlider.prototype = {
        /**
         * Инициализируем плагин, устанавливаем первоначальные значения
         */
        init: function () {
            this.appendTemplate();
            this.createEvents();

            this._calcLabelPosition();

            this.coords.rs_left_offset = this.$cache.rs.offset().left;
            this.coords.w_rs = this._toFixed(this.$cache.rs.outerWidth(false));

            this.tooltip.tooltip_from_value = this.options.min;
            this.tooltip.tooltip_to_value = this.options.max;

            this.coords.p_this = this.coords.p_from;
            this.tooltip.tooltip_cur_value = this.options.min;
            this._changeFrom();

            this.coords.p_this = this.coords.p_to;
            this.tooltip.tooltip_cur_value = this.options.max;
            this._changeTo();

            this._barChange();

            this.initGrid();
        },
        /**
         * Добавляем шаблоны
         */
        appendTemplate: function () {
            this.$cache.objSlider.html(layoutHtml);
            this.$cache.from = this.$cache.objSlider.find('.rs__handle_from');
            this.$cache.to = this.$cache.objSlider.find('.rs__handle_to');
            this.$cache.rs = this.$cache.objSlider.find('.rs');
            this.$cache.line = this.$cache.objSlider.find('.rs__field');
            this.$cache.bar = this.$cache.objSlider.find('.rs__range');
            this.$cache.pointers = this.$cache.objSlider.find('.rs__handle');
            this.$cache.grid = this.$cache.objSlider.find('.rs__grid');
            this.$cache.tooltip_from = this.$cache.objSlider.find('.rs__handle-value_from');
            this.$cache.tooltip_to = this.$cache.objSlider.find('.rs__handle-value_to');
            this.$cache.tooltip_single = this.$cache.objSlider.find('.rs__handle-value_single');

            if (!this.options.tooltip_set) {
                $('.rs__handle-value', this.$cache.rs).hide();
            }
        },
        /**
         * Создаём все необходимые события для работы плагина,
         * включая тачскрин устройства
         */
        createEvents: function () {
            this.$cache.win.on('touchmove.' + this.pluginNamespace, this.draggingMove.bind(this));
            this.$cache.win.on('mousemove.' + this.pluginNamespace, this.draggingMove.bind(this));

            this.$cache.win.on('touchend.' + this.pluginNamespace, this.endMove.bind(this));
            this.$cache.win.on('mouseup.' + this.pluginNamespace, this.endMove.bind(this));

            this.$cache.win.on('resize.' + this.pluginNamespace+' orientationchange.' + this.pluginNamespace, this.resizeMove.bind(this));

            this.$cache.from.on('touchstart.' + this.pluginNamespace, this.startMove.bind(this, 'from'));
            this.$cache.to.on('touchstart.' + this.pluginNamespace, this.startMove.bind(this, 'to'));

            this.$cache.from.on('mousedown.' + this.pluginNamespace, this.startMove.bind(this, 'from'));
            this.$cache.to.on('mousedown.' + this.pluginNamespace, this.startMove.bind(this, 'to'));

            this.$cache.line.on('touchstart.' + this.pluginNamespace, this.startMove.bind(this, 'click'));
            this.$cache.line.on('mousedown.' + this.pluginNamespace, this.startMove.bind(this, 'click'));
        },
        /**
         * Движение перетаскиванием
         *
         * @param e
         */
        draggingMove: function (e) {
            if (!this.is_dragging) {
                return;
            }

            var x = e.pageX || e.originalEvent.touches && e.originalEvent.touches[0].pageX;
            x = (x) ? x : 0;

            this.coords.x_pointer = x - this.coords.rs_left_offset;
            this.renderSlider();
        },
        /**
         * Начинаем двигать ползунок
         *
         * @param target
         * @param e
         */
        startMove: function (target, e) {
            if (this.is_active) {
                return;
            }

            this.onStart();

            e.preventDefault();

            var x = e.pageX || e.originalEvent.touches && e.originalEvent.touches[0].pageX;

            if (e.button === 2) {
                return;
            }

            this.target = target;

            this.is_active = true;
            this.is_dragging = true;

            this.coords.rs_left_offset = this.$cache.rs.offset().left;
            this.coords.x_pointer = x - this.coords.rs_left_offset;

            this.renderSlider();
        },
        /**
         * Завершили движение
         */
        endMove: function () {
            if (this.is_active) {
                this.is_active = false;
            } else {
                return;
            }

            this.renderSlider();

            this.is_dragging = false;
            this.is_click = false;

            this.onFinish();
        },
        /**
         * Просчитываем при resize
         */
        resizeMove: function () {
            this.coords.rs_left_offset = this.$cache.rs.offset().left;
            this.coords.w_rs = this._toFixed(this.$cache.rs.outerWidth(false));

            this.coords.p_this = this.coords.p_from;
            this.tooltip.tooltip_cur_value = this.tooltip.tooltip_from_value;
            this._changeFrom();

            this.coords.p_this = this.coords.p_to;
            this.tooltip.tooltip_cur_value = this.tooltip.tooltip_to_value;
            this._changeTo();

            this._barChange();
        },
        renderSlider: function () {
            this._changeSlider();
        },
        /**
         * Двигаем ползунок
         */
        _changeSlider: function () {
            this._calcPercentPosition();

            switch (this.target) {
                case 'from':
                    this._changeFrom();
                    break;
                case 'to':
                    this._changeTo();
                    break;
                case 'click':
                    if (this.is_click) {
                        return;
                    }

                    var p_rel_from  = this.coords.p_this - this.coords.p_from,
                        p_rel_to    = this.coords.p_to - this.coords.p_this;

                    // При клике определяем какой ползунок ближе
                    this[(p_rel_from <= p_rel_to) ? '_changeFrom' : '_changeTo']();
                    this.is_click = true;

                    break;
            }

            this.onChange();
            this._barChange();
            this._gridHover();
        },
        /**
         * Получаем позицию с учётом шага и числа для tooltip
         * с учётом диапазона в котором находится ползунок
         *
         * @private
         */
        _calcPercentPosition: function () {
            this.coords.w_rs = this._toFixed(this.$cache.rs.outerWidth(false));

            var p_position = this._fixPercent(this.coords.x_pointer / (this.coords.w_rs / 100)),
                position_max = this.coords.grid_p_main_position.length,
                c,
                key, // Номер сегмента
                step,
                dynamic_step = this.options.grid_labels_step.length;

            for (c = 1; c <= position_max; c++) {
                key = c - 1;
                if (p_position <= this.coords.grid_p_main_position[(key)]) { break; }
            }

            // Определяем шаг для текущего сегмента
            if (dynamic_step !== 0 || this.options.grid_set) {
                step = (this.options.grid_labels_step[key - 1] ?
                    this.options.grid_labels_step[key - 1] :
                    this.options.grid_labels_step[((key - 1) === -1) ? 0 : dynamic_step - 1]);
            }

            if (!step) {
                step = this.options.step;
            }

            var max              = this.options.grid_labels[key],
                min              = this.options.grid_labels[key - 1],
                // Ширина одного сегмента
                w_ps_label       = this._toFixed(this.coords.w_rs / (position_max - 1)),
                // Определяем процентное положение курсора относительно сегмета в котором находимся
                x_pointer        = (key > 1) ? (this.coords.x_pointer - (w_ps_label * (key-1))) : this.coords.x_pointer,
                p_label_position = this._fixPercent(x_pointer / (w_ps_label / 100));

            // Корректируем
            max = (key === 0 ? this.options.grid_labels[key+1] : max);
            min = (min ? min : this.options.grid_labels[0]);

            var label_diapason = this._toFixed(max - min),
                value_label = this._toFixed(((label_diapason / 100) * p_label_position) + min),
                value_step  = this._roundToMultiple(value_label, step),
                // Процентное положение курсора в текущем сегменте с учётом шага
                p_step_label = this._toFixed((value_step - min) / (label_diapason / 100)),
                // Левое смешение относительно края в пикселях для текущего значения с учётом шага и секции
                left_offset_step = this._toFixed(((w_ps_label / 100) * p_step_label) + (w_ps_label * (key - 1)));

            this.tooltip.tooltip_cur_value = value_step;
            this.coords.p_this = this._fixPercent(left_offset_step * 100 / this.coords.w_rs);
        },
        /**
         * Создаём сегменты
         *
         * @private
         */
        _calcLabelPosition: function () {
            // Если главные значения не заданы
            if (this.options.grid_labels.length === 0 || !this.options.grid_set) {
                this.options.grid_labels = [this.options.min, this.options.max]
            }

            // Проверяем, чтобы значения label были в рамках min и max
            var labelTmp = [],
                max = (this.options.grid_labels.length - 1);

            for (var c = 0; c <= max; c++) {
                if (this.options.min <= this.options.grid_labels[c] && this.options.max >= this.options.grid_labels[c]) {
                    labelTmp.push(this.options.grid_labels[c]);
                }
            }

            // Add mim value
            if (labelTmp[0] > this.options.min) {
                labelTmp.unshift(this.options.min);
            }

            // Add max value
            if (labelTmp[labelTmp.length - 1] < this.options.max) {
                labelTmp.push(this.options.max);
            }

            this.options.grid_labels = labelTmp;

            var ml,
                bl,
                bl_max = this.options.grid_labels.length,
                p_l = 100 / (((bl_max*this.options.grid_num) - this.options.grid_num) + bl_max - 1),
                set_p_l = 0,
                left_offset = 0;

            for (bl = 1; bl <= bl_max; bl++) {
                left_offset = this._toFixed(set_p_l*p_l);
                this.coords.grid_p_main_position.push(left_offset);
                this.coords.grid_p_position.push(left_offset);

                set_p_l++;

                if (bl === bl_max) {
                    break;
                }

                for (ml = 1; ml <= this.options.grid_num; ml++) {
                    left_offset = this._toFixed(set_p_l*p_l);
                    this.coords.grid_p_position.push(left_offset);
                    set_p_l++;
                }
            }
        },
        /**
         * @param value
         * @returns {*}
         * @private
         */
        _fixPercent: function (value) {
            if (value < 0) { return 0; }
            if (value > 100) { return 100; }
            return this._toFixed(value);
        },
        _roundToMultiple: function(num, step) {
            return Math.round((num / step)) * step;
        },
        _changeFrom: function () {
            // Не даём ползунку уйти дальше положенного
            this.coords.p_this = (this.coords.p_this <= this.coords.p_to) ? this.coords.p_this : this.coords.p_to;
            // Не даём значению в tooltip уйти дальше положенного
            this.tooltip.tooltip_cur_value = (this.tooltip.tooltip_cur_value <= this.tooltip.tooltip_to_value) ? this.tooltip.tooltip_cur_value : this.tooltip.tooltip_to_value;

            this.$cache.from[0].style.left = this._toFixed(this.coords.p_this) + '%';
            this.coords.p_from = this._toFixed(this.coords.p_this);
            this._changeTooltip('from');
            this._setLastActivePointer(this.$cache.from);
        },
        _changeTo: function () {
            // Не даём ползунку уйти дальше положенного
            this.coords.p_this = (this.coords.p_this >= this.coords.p_from) ? this.coords.p_this : this.coords.p_from;
            // Не даём значению в tooltip уйти дальше положенного
            this.tooltip.tooltip_cur_value = (this.tooltip.tooltip_cur_value >= this.tooltip.tooltip_from_value) ? this.tooltip.tooltip_cur_value : this.tooltip.tooltip_from_value;

            this.$cache.to[0].style.left = this._toFixed(this.coords.p_this) + '%';
            this.coords.p_to = this._toFixed(this.coords.p_this);
            this._changeTooltip('to');
            this._setLastActivePointer(this.$cache.to);
        },
        _barChange: function () {
            this.coords.w_bar = this._toFixed(this.coords.p_to - this.coords.p_from);
            this.$cache.bar[0].style.left = this._toFixed(this.coords.p_from) + '%';
            this.$cache.bar[0].style.width = this.coords.w_bar + '%';
        },
        _toFixed: function (num) {
            return +(num.toFixed(15));
        },
        /**
         * Двигаем Tooltip
         *
         * @param type - from/to
         * @private
         */
        _changeTooltip: function (type) {
            if (!this.options.tooltip_set) {
                return;
            }

            this.tooltip[(type === 'from') ? 'tooltip_from_value' : 'tooltip_to_value'] = this.tooltip.tooltip_cur_value;
            $('p', this.$cache[(type === 'from') ? 'tooltip_from' : 'tooltip_to'])
                .text(this._tooltipText(this.tooltip[(type === 'from') ? 'tooltip_from_value' : 'tooltip_to_value']));

            $('p', this.$cache.tooltip_single)
                .text(this._tooltipTextSingle(this.tooltip.tooltip_from_value, this.tooltip.tooltip_to_value));

            // Ширина ползунка
            var wPointer          = (this.$cache[(type === 'from') ? 'from' : 'to'][0].offsetWidth),
                // Ширина tooltip
                wTooltip          = this.$cache[(type === 'from') ? 'tooltip_from' : 'tooltip_to'][0].offsetWidth,
                wTooltipSingle    = this.$cache.tooltip_single[0].offsetWidth,
                // Правый край в процентах
                p_max             = (this.coords.w_rs - ((wTooltip - wPointer) / 2)) / (this.coords.w_rs / 100),
                p_min             = ((wTooltip - wPointer) / 2) / (this.coords.w_rs / 100),
                p_max_single      = (this.coords.w_rs - ((wTooltipSingle - wPointer) / 2)) / (this.coords.w_rs / 100),
                p_min_single      = ((wTooltipSingle - wPointer) / 2) / (this.coords.w_rs / 100),
                p                 = this.coords.p_this,
                // Вычисляем положение для одиночного tooltip
                p_single          = ((this.coords.p_to - this.coords.p_from) / 2) + this.coords.p_from,
                p_Tooltip         = this._tooltipPosition(p_max, p_min, p, wTooltip),
                p_TooltipSingle   = this._tooltipPosition(p_max_single, p_min_single, p_single, wTooltipSingle),
                fromTooltipOffset = this._toFixed(((this.coords.p_from >= p_min ? this.coords.p_from : p_min) * this.coords.w_rs / 100) + (this.$cache.tooltip_from[0].offsetWidth / 2)),
                toTooltipOffset   = this._toFixed(((this.coords.p_to <= p_max ? this.coords.p_to : p_max) * this.coords.w_rs / 100) - (this.$cache.tooltip_to[0].offsetWidth / 2));

            // // Определяем что tooltip`ы рядом
            if (fromTooltipOffset >= toTooltipOffset) {
                this.$cache.tooltip_from[0].style.visibility = 'hidden';
                this.$cache.tooltip_to[0].style.visibility = 'hidden';
                this.$cache.tooltip_single[0].style.visibility = 'visible';
            } else {
                this.$cache.tooltip_from[0].style.visibility = 'visible';
                this.$cache.tooltip_to[0].style.visibility = 'visible';
                this.$cache.tooltip_single[0].style.visibility = 'hidden';
            }

            $('div', this.$cache[(type === 'from') ? 'tooltip_from' : 'tooltip_to'])[0].style.left = p_Tooltip.p_arrow + '%';
            this.$cache[(type === 'from') ? 'tooltip_from' : 'tooltip_to'][0].style.left = p_Tooltip.p + '%';

            $('div', this.$cache.tooltip_single)[0].style.left = p_TooltipSingle.p_arrow + '%';
            this.$cache.tooltip_single[0].style.left = p_TooltipSingle.p + '%';
        },
        /**
         * Высчитываем позицию для tooltip, с учётом краёв шкалы
         *
         * @param p_max - максимальная позиция
         * @param p_min - минимальная позиция
         * @param p - текущая позиция Tooltip
         * @param wTooltip - Ширина текущего Tooltip
         * @returns {{p: *, p_arrow: number}}
         * @private
         */
        _tooltipPosition: function (p_max, p_min, p, wTooltip) {
            var p_arrow = 0;

            if (p_max < p) {
                p_arrow = this._toFixed(((p * (this.coords.w_rs / 100)) - (p_max * (this.coords.w_rs / 100)) + ((wTooltip) / 2)) * 100 / wTooltip);
                p = p_max;
            } else if (p_min > p) {
                p_arrow = this._toFixed(((p * (this.coords.w_rs / 100)) - (p_min * (this.coords.w_rs / 100)) + ((wTooltip) / 2)) * 100 / wTooltip);
                p = p_min;
            } else {
                // Выставляем обратно в центр
                p_arrow = 50;
            }

            return {
                'p' : p,
                'p_arrow' : p_arrow
            }
        },
        /**
         * @param value
         * @returns {string}
         * @private
         */
        _tooltipText: function (value) {
            if (typeof this.options.tooltip_value_format.callBack === 'function') {
                return this.options.tooltip_value_format.callBack(value);
            } else {
                return this._numberFormat(
                    value,
                    this.options.tooltip_value_format.decimals,
                    this.options.tooltip_value_format.dec_point,
                    this.options.tooltip_value_format.thousands_sep
                ) + this.options.tooltip_value_format.prefix;
            }
        },
        /**
         * @param valueMin
         * @param valueMax
         * @returns {*}
         * @private
         */
        _tooltipTextSingle: function (valueMin, valueMax) {
            if (valueMin !== valueMax) {
                if (typeof this.options.tooltip_value_format.callBack === 'function') {
                    return this.options.tooltip_value_format.callBack(valueMin)
                        + this.options.tooltip_value_format.delimiter +
                        this.options.tooltip_value_format.callBack(valueMax);
                } else {
                    return this._numberFormat(
                        valueMin,
                        this.options.tooltip_value_format.decimals,
                        this.options.tooltip_value_format.dec_point,
                        this.options.tooltip_value_format.thousands_sep
                    ) + this.options.tooltip_value_format.delimiter + this._numberFormat(
                        valueMax,
                        this.options.tooltip_value_format.decimals,
                        this.options.tooltip_value_format.dec_point,
                        this.options.tooltip_value_format.thousands_sep
                    ) + this.options.tooltip_value_format.prefix;
                }
            } else {
                return this._tooltipText(valueMin);
            }
        },
        /**
         * @param number
         * @param decimals
         * @param dec_point
         * @param thousands_sep
         * @returns {string}
         * @private
         */
        _numberFormat: function (number, decimals, dec_point, thousands_sep) {
            number = (number + '').replace(/[^0-9+\-Ee.]/g, '');

            var n = !isFinite(+number) ? 0 : +number,
                prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
                sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
                dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
                toFixedFix = function(n, prec) {
                    var k = Math.pow(10, prec);
                    return '' + (Math.round(n * k) / k).toFixed(prec);
                };

            // Fix for IE parseFloat(0.55).toFixed(0) = 0;
            var s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');

            if (s[0].length > 3) {
                s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
            }

            if ((s[1] || '').length < prec) {
                s[1] = s[1] || '';
                s[1] += new Array(prec - s[1].length + 1).join('0');
            }

            return s.join(dec);
        },
        /**
         * Инициализируем параметры для шкалы
         *
         * @private
         */
        initGrid: function () {
            if (!this.options.grid_set) {
                return;
            }

            this.is_grid = true;

            this._gridRender();
            this._gridHover();
        },
        /**
         * Рисуем шкалу
         *
         * @private
         */
        _gridRender: function () {
            if (!this.is_grid) {
                return;
            }

            var htmlGrid = '',
                _self = this,
                label_key;

            $.each(this.coords.grid_p_position, function (i, v) {
                label_key = $.inArray(v, _self.coords.grid_p_main_position);

                if (label_key !== -1) {
                    htmlGrid +=
                        '<div style="left: '+ v +'%;" class="rs__tick rs__tick_big">' +
                        _self._gritLineText(_self.options.grid_labels[label_key]) +
                        '</div>';
                } else {
                    htmlGrid += '<div style="left: '+ v +'%;" class="rs__tick"></div>';
                }
            });

            this.$cache.grid.html(htmlGrid);
        },
        /**
         * Рисуем метки на шкале
         *
         * @param value
         * @returns {string}
         * @private
         */
        _gritLineText: function (value) {
            if (this.options.grid_value_set === true) {
                if (typeof this.options.grid_value_format.callBack === 'function') {
                    return '<div class="rs__tick-txt">' + this.options.grid_value_format.callBack(value) + '</div>';
                } else {
                    var text = '';

                    value = this._numberFormat(
                        value,
                        this.options.grid_value_format.decimals,
                        this.options.grid_value_format.dec_point,
                        this.options.grid_value_format.thousands_sep
                    );

                    text += '<p>'+value+'</p>';
                    text += (this.options.grid_value_set === true) ? '<p>'+this.options.grid_value_format.prefix+'</p>' : '';

                    return '<div class="rs__tick-txt">'+text+'</div>';
                }
            } else {
                return '';
            }
        },
        /**
         * Закрашиваем выделенную область на шкале
         *
         * @private
         */
        _gridHover: function () {
            if (!this.is_grid) {
                return;
            }

            var _self = this;

            $('.rs__tick', _self.$cache.grid).each(function (i, v) {
                var l = parseFloat(v.style.left);

                v.className = v.className.replace(' rs__tick_selected', '');

                if (_self.coords.p_from <= l && _self.coords.p_to >= l) {
                    v.className = v.className+' rs__tick_selected';
                }
            });
        },
        /**
         * Устанавливаем последний активный ползунок
         *
         * @param $pointer
         * @private
         */
        _setLastActivePointer: function ($pointer) {
            this.$cache.lastActivePointer = $pointer;
            this.$cache.pointers.removeClass('rs__handle_active');
            this.$cache.lastActivePointer.addClass('rs__handle_active');
        },
        /**
         * callback start
         */
        onStart: function () {
            if (typeof this.options.onStart === 'function') {
                this.options.onStart(this);
            }
        },
        onChange: function () {
            if (typeof this.options.onChange === 'function') {
                this.options.onChange(this);
            }
        },
        /**
         * callback finish
         */
        onFinish: function () {
            if (typeof this.options.onFinish === 'function') {
                this.options.onFinish(this);
            }
        }
    };

    $.fn.rangeSlider = function(param) {
        return this.each(function() {
            if (!$.data(this, 'rangeSlider')) {
                $.data(
                    this,
                    'rangeSlider',
                    new RangeSlider(this, param, pluginCount++)
                );
            }
        });
    };
})(jQuery);