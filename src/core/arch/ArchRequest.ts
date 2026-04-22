/* eslint-disable */
import { NextResponse } from 'next/server';

type Primitive = 'string' | 'number' | 'boolean' | 'object' | 'array';

type FieldRule =
  | readonly [name: string, type: Primitive]
  | readonly [name: string, type: Primitive, opts?: { optional?: boolean }];

type InferFieldType<T extends Primitive> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'array'
        ? unknown[]
        : T extends 'object'
          ? Record<string, unknown>
          : unknown;

type Schema = readonly FieldRule[];

type InferFromSchema<S extends Schema> = {
  [K in S[number] as K extends readonly [infer N extends string, any, infer O]
    ? O extends { optional: true }
      ? never
      : N
    : K extends readonly [infer N extends string, any]
      ? N
      : never]: K extends readonly [
    infer N extends string,
    infer T extends Primitive,
    any?,
  ]
    ? InferFieldType<T>
    : never;
} & {
  [K in S[number] as K extends readonly [infer N extends string, any, infer O]
    ? O extends { optional: true }
      ? N
      : never
    : never]?: K extends readonly [
    infer N extends string,
    infer T extends Primitive,
    any?,
  ]
    ? InferFieldType<T>
    : never;
};

function isType(value: unknown, type: Primitive) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object')
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  return typeof value === type;
}

export class ArchRequest {
  static async bodyFromRequest<S extends Schema>(
    req: Request,
    schema: S
  ): Promise<
    | { ok: true; data: InferFromSchema<S> }
    | { ok: false; response: NextResponse }
  > {
    let json: unknown;

    try {
      json = await req.json();
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        ),
      };
    }

    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Body must be a JSON object' },
          { status: 400 }
        ),
      };
    }

    const obj = json as Record<string, unknown>;
    const errors: string[] = [];

    for (const rule of schema) {
      const [name, type, opts] = rule as FieldRule;
      const value = obj[name];
      const optional = opts?.optional === true;

      if (value === undefined) {
        if (!optional) errors.push(`${name} is required`);
        continue;
      }
      if (!isType(value, type)) {
        errors.push(`${name} must be ${type}`);
      }
    }

    if (errors.length) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Invalid body', details: errors },
          { status: 400 }
        ),
      };
    }

    return { ok: true, data: obj as InferFromSchema<S> };
  }
}
