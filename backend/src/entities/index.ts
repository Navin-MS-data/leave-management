import { LeaveRequest } from './leave-request.entity';
import { LeaveType } from './leave-type.entity';
import { PublicHoliday } from './public-holiday.entity';
import { Setting } from './setting.entity';
import { User } from './user.entity';

export { LeaveRequest, LeaveType, PublicHoliday, Setting, User };
export const ALL_ENTITIES = [User, LeaveType, LeaveRequest, PublicHoliday, Setting];
