import { Operators } from '../columnsOperators';
import { ColumnType } from './columnType';
import { joinTruthy } from '../utils';
import { assignMethodsToClass } from './utils';
import { numberTypeMethods } from './commonMethods';

export interface BaseNumberData {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  multipleOf?: number;
}

export type NumberColumn = ColumnType<number>;

export type NumberColumnData = BaseNumberData;

type NumberMethods = typeof numberMethods;
const numberMethods = numberTypeMethods<ColumnType>();

export interface NumberBaseColumn<Type>
  extends ColumnType<Type, typeof Operators.number>,
    NumberMethods {}

export abstract class NumberBaseColumn<Type> extends ColumnType<
  Type,
  typeof Operators.number
> {
  data = {} as NumberColumnData;
  operators = Operators.number;
}

assignMethodsToClass(NumberBaseColumn, numberMethods);

export interface DecimalColumnData extends NumberColumnData {
  precision?: number;
  scale?: number;
}

export class DecimalBaseColumn<
  Type extends number | string,
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends NumberBaseColumn<Type> {
  data: DecimalColumnData & { precision: Precision; scale: Scale };
  dataType = 'decimal' as const;

  constructor(precision?: Precision, scale?: Scale) {
    super();

    this.data = {
      precision,
      scale,
    } as DecimalColumnData & { precision: Precision; scale: Scale };
  }

  toSQL() {
    const { precision, scale } = this.data;

    return joinTruthy(
      this.dataType,
      precision
        ? scale
          ? `(${precision}, ${scale})`
          : `(${precision})`
        : undefined,
    );
  }
}

// signed two-byte integer
export class SmallIntColumn extends NumberBaseColumn<number> {
  dataType = 'smallint' as const;
  parseItem = parseInt;
}

// signed four-byte integer
export class IntegerColumn extends NumberBaseColumn<number> {
  dataType = 'integer' as const;
  parseItem = parseInt;
}

// signed eight-byte integer
export class BigIntColumn extends NumberBaseColumn<string> {
  dataType = 'bigint' as const;
}

// exact numeric of selectable precision
export class DecimalColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends DecimalBaseColumn<string, Precision, Scale> {}

// single precision floating-point number (4 bytes)
export class RealColumn extends NumberBaseColumn<number> {
  dataType = 'real' as const;
  parseItem = parseFloat;
}

// double precision floating-point number (8 bytes)
export class DoublePrecisionColumn extends NumberBaseColumn<string> {
  dataType = 'double precision' as const;
}

// autoincrementing two-byte integer
export class SmallSerialColumn extends NumberBaseColumn<number> {
  dataType = 'smallserial' as const;
  parseItem = parseInt;
}

// autoincrementing four-byte integer
export class SerialColumn extends NumberBaseColumn<number> {
  dataType = 'serial' as const;
  parseItem = parseInt;
}

// autoincrementing eight-byte integer
export class BigSerialColumn extends NumberBaseColumn<string> {
  dataType = 'bigserial' as const;
}
