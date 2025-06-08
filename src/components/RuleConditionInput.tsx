import cx from 'clsx';
import * as React from 'react';
import * as Reactodia from '@reactodia/workspace';

import { type SceneRuleCondition, serializeCondition, deserializeCondition } from '../model/sceneRules';

import styles from './RuleConditionInput.module.css';

export function RuleConditionInput(props: Reactodia.FormInputSingleProps) {
  const { value, setValue, factory } = props;

  const [condition, setCondition] = React.useState(() => parseCondition(value));
  React.useEffect(() => {
    setCondition(previous =>
      Reactodia.Rdf.equalTerms(previous.expression, value)
        ? previous : parseCondition(value)
    );
  }, [value]);

  const updateCondition = (nextCondition: ParsedCondition) => {
    const validatedCondition = buildCondition(nextCondition, factory);
    setCondition(validatedCondition);
    if (validatedCondition.built) {
      setValue(validatedCondition.expression);
    }
  };

  return (
    <div className={styles.component}>
      <label className={styles.groupLabel}>property</label>
      <label className={styles.groupLabel}>operator</label>
      <label className={styles.groupLabel}>value</label>
      <input className='reactodia-form-control'
        placeholder='property name'
        value={condition.name}
        onChange={e => {
          updateCondition({ ...condition, name: e.currentTarget.value });
        }}
      />
      <select className={cx('reactodia-form-control', styles.operator)}
        value={condition.operator}
        onChange={e => {
          const nextValue = e.currentTarget.value as SceneRuleCondition['operator'];
          updateCondition({ ...condition, operator: nextValue });
        }}>
        <option value='EQ'>=</option>
        <option value='GT'>&gt;</option>
        <option value='GE'>&gt;=</option>
        <option value='LT'>&lt;</option>
        <option value='LE'>&lt;=</option>
      </select>
      <input className='reactodia-form-control'
        type='numeric'
        pattern='\d+.\d+'
        placeholder='property name'
        value={condition.value}
        onChange={e => {
          updateCondition({ ...condition, value: e.currentTarget.value });
        }}
      />
      {condition.validationMessage ? (
        <div className={styles.validation}>
          {condition.validationMessage}
        </div>
      ) : null}
    </div>
  );
}

interface ParsedCondition {
  readonly expression: Reactodia.Rdf.NamedNode | Reactodia.Rdf.Literal;
  readonly built: SceneRuleCondition | undefined;

  readonly name: string;
  readonly operator: SceneRuleCondition['operator'];
  readonly value: string;

  readonly validationMessage?: string | undefined;
}

function parseCondition(expression: Reactodia.Rdf.NamedNode | Reactodia.Rdf.Literal): ParsedCondition {
  let validationMessage: string | undefined;
  if (expression.termType === 'Literal') {
    try {
      const deserialized = deserializeCondition(expression);
      return {
        expression,
        built: deserialized,
        name: deserialized.name,
        operator: deserialized.operator,
        value: String(deserialized.value),
      };
    } catch (_err) {
      const message = _err && typeof _err === 'object' && 'message' in _err ? _err.message : undefined;
      validationMessage = `Invalid condition: ${message}`;
    }
  } else {
    validationMessage = 'Condition is not a literal';
  }
  return {
    expression,
    built: undefined,
    name: '',
    operator: 'EQ',
    value: '',
    validationMessage,
  };
}

function buildCondition(condition: ParsedCondition, factory: Reactodia.Rdf.DataFactory): ParsedCondition {
  if (!/^[a-z0-9_]+$/.test(condition.name)) {
    return {
      ...condition,
      built: undefined,
      validationMessage: `Condition property name should only include characters from [a-z0-9_]+`,
    };
  }

  const conditionValue = Number(condition.value);
  if (!Number.isFinite(conditionValue)) {
    return { ...condition, built: undefined, validationMessage: `Invalid numeric value for the condition` };
  }

  const built: SceneRuleCondition = {
    name: condition.name,
    operator: condition.operator,
    value: conditionValue,
  };
  return {
    ...condition,
    expression: serializeCondition(built, factory),
    built,
    validationMessage: undefined,
  };
}
