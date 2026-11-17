import { z } from 'zod';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Client-side checks that give instant feedback. The API repeats every rule and has the last word. */
export const requestSchema = z
  .object({
    leaveTypeId: z.string().min(1, 'Choose a leave type'),
    startDate: z.string().regex(ISO, 'Choose a start date'),
    endDate: z.string().regex(ISO, 'Choose an end date'),
    reason: z
      .string()
      .trim()
      .min(1, 'Give a short reason')
      .max(500, 'Keep the reason under 500 characters'),
  })
  .refine((v) => !ISO.test(v.startDate) || !ISO.test(v.endDate) || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before the start date',
  });

export type RequestFormValues = z.infer<typeof requestSchema>;
