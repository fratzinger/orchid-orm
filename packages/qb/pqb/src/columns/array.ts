import { ColumnData, ColumnType } from './columnType';
import {
  addCode,
  Code,
  ArrayMethodsData,
  arrayDataToCode,
  ColumnSchemaConfig,
  ColumnTypeSchemaArg,
  ColumnDataBase,
  Codes,
} from 'orchid-core';
import { columnCode } from './code';
import { Operators, OperatorsArray } from './operators';

export interface ArrayColumnValue {
  type: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
  inputType: unknown;
  outputType: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputSchema: any;
  queryType: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  querySchema: any;
  toSQL(): string;
  toCode(t: string, m?: boolean): Code;
  parseItem?(input: string): unknown;
  data: ColumnDataBase;
}

export interface ArrayData<Item extends ArrayColumnValue>
  extends ColumnData,
    ArrayMethodsData {
  item: Item;
}

export class ArrayColumn<
  Schema extends ColumnTypeSchemaArg,
  Item extends ArrayColumnValue,
  InputType,
  OutputType,
  QueryType,
> extends ColumnType<
  Schema,
  Item['type'][],
  InputType,
  OperatorsArray,
  Item['inputType'][],
  Item['outputType'][],
  OutputType,
  Item['queryType'][],
  QueryType
> {
  dataType = 'array' as const;
  operators = Operators.array;
  declare data: ArrayData<Item>;

  constructor(
    schema: Schema,
    item: Item,
    inputType: InputType,
    outputType?: OutputType,
    queryType?: QueryType,
  ) {
    super(schema, inputType, outputType, queryType);
    this.data.item = item;
    this.data.name = item.data.name;
  }

  toSQL(): string {
    return `${this.data.item.toSQL()}[]`;
  }

  toCode(
    this: ArrayColumn<
      ColumnSchemaConfig,
      ArrayColumnValue,
      unknown,
      unknown,
      unknown
    >,
    t: string,
    m?: boolean,
  ): Code {
    const code: Codes = ['array('];
    addCode(code, this.data.item.toCode(t));
    addCode(code, `)${arrayDataToCode(this.data, m)}`);
    return columnCode(this, t, code, m);
  }

  parseFn = Object.assign(
    (input: unknown) => {
      const entries: unknown[] = [];
      parseArray(
        input as string,
        0,
        (input as string).length,
        entries,
        false,
        this.data.item,
      );
      return entries;
    },
    {
      hideFromCode: true,
    },
  );
}

const parseArray = (
  input: string,
  pos: number,
  len: number,
  entries: unknown[],
  nested: boolean,
  item: ArrayColumnValue,
): number => {
  if (input[0] === '[') {
    while (pos < len) {
      let char = input[pos++];
      if (char === '\\') {
        char = input[pos++];
      }
      if (char === '=') break;
    }
  }

  let quote = false;
  let start = pos;
  while (pos < len) {
    let char = input[pos++];
    const escaped = char === '\\';
    if (escaped) {
      char = input[pos++];
    }

    if (char === '"' && !escaped) {
      if (quote) {
        pushEntry(input, start, pos, entries, item);
      } else {
        start = pos;
      }
      quote = !quote;
    } else if (char === ',' && !quote) {
      if (start !== pos) {
        pushEntry(input, start, pos, entries, item);
      }
      start = pos;
    } else if (char === '{' && !quote) {
      let array: unknown[];
      let nestedItem = item;
      if (nested) {
        array = [];
        entries.push(array);
        if ('item' in item.data) {
          nestedItem = (
            item as unknown as { data: ArrayData<ArrayColumnValue> }
          ).data.item as ArrayColumnValue;
        }
      } else {
        array = entries;
      }
      pos = parseArray(input, pos, len, array, true, nestedItem);
      start = pos + 1;
    } else if (char === '}' && !quote) {
      if (start !== pos) {
        pushEntry(input, start, pos, entries, item);
      }
      start = pos + 1;
      break;
    }
  }

  return pos;
};

const pushEntry = (
  input: string,
  start: number,
  pos: number,
  entries: unknown[],
  item: ArrayColumnValue,
) => {
  let entry: unknown = input.slice(start, pos - 1);
  if (entry === 'NULL') {
    entry = null;
  } else if (item.parseItem) {
    entry = item.parseItem(entry as string);
  }
  entries.push(entry);
};
