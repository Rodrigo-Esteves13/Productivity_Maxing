import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateNotebookEntryDto } from './upsert-notebook-entry.dto';
import { CreatePriorityDto } from '../../priorities/dto/create-priority.dto';
import { CreateTaskTypeDto } from '../../task-types/dto/create-task-type.dto';
import { CreateAcademicTaskTypeDto } from '../../task-types/dto/create-academic-task-type.dto';
import { PurgeSecurityLogsDto } from '../../security-logs/dto/purge-security-logs.dto';
import { NOTEBOOK_CLASS_NUMBER_MAX } from '../notebook.constants';
import { PRIORITY_ORDER_MAX } from '../../priorities/priorities.constants';
import { TASK_TYPE_ORDER_MAX } from '../../task-types/task-types.constants';
import { SECURITY_LOGS_PURGE_MAX_DAYS } from '../../security-logs/security-logs.constants';

const UUID = '3f2c1b5e-8a41-4c8e-9a3f-1b2c3d4e5f60';

async function errorsOn(cls: new () => object, plain: object, prop: string) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.filter((e) => e.property === prop);
}

describe('DTO @Max (S-19)', () => {
  it('classNumber acima do maximo e rejeitado', async () => {
    const base = { areaId: UUID, title: 'x' };
    expect(
      await errorsOn(
        CreateNotebookEntryDto,
        { ...base, classNumber: NOTEBOOK_CLASS_NUMBER_MAX + 1 },
        'classNumber',
      ),
    ).toHaveLength(1);
    expect(
      await errorsOn(
        CreateNotebookEntryDto,
        { ...base, classNumber: NOTEBOOK_CLASS_NUMBER_MAX },
        'classNumber',
      ),
    ).toHaveLength(0);
  });

  it('order de prioridades e tipos de tarefa tem teto', async () => {
    expect(
      await errorsOn(
        CreatePriorityDto,
        { label: 'a', order: PRIORITY_ORDER_MAX + 1 },
        'order',
      ),
    ).toHaveLength(1);
    expect(
      await errorsOn(
        CreateTaskTypeDto,
        { label: 'a', order: TASK_TYPE_ORDER_MAX + 1 },
        'order',
      ),
    ).toHaveLength(1);
    expect(
      await errorsOn(
        CreateAcademicTaskTypeDto,
        { label: 'a', taskTypeId: UUID, order: TASK_TYPE_ORDER_MAX + 1 },
        'order',
      ),
    ).toHaveLength(1);
    expect(
      await errorsOn(
        CreateAcademicTaskTypeDto,
        { label: 'a', taskTypeId: UUID, order: TASK_TYPE_ORDER_MAX },
        'order',
      ),
    ).toHaveLength(0);
  });

  it('purge olderThanDays tem teto', async () => {
    expect(
      await errorsOn(
        PurgeSecurityLogsDto,
        { olderThanDays: SECURITY_LOGS_PURGE_MAX_DAYS + 1 },
        'olderThanDays',
      ),
    ).toHaveLength(1);
    expect(
      await errorsOn(
        PurgeSecurityLogsDto,
        { olderThanDays: SECURITY_LOGS_PURGE_MAX_DAYS },
        'olderThanDays',
      ),
    ).toHaveLength(0);
  });
});
