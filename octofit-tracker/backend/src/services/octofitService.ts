import { Activity, Team, User, Workout } from '../models/index.js';
import { Types } from 'mongoose';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw Object.assign(new Error('Activity input must be an object'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string' ||
    !Types.ObjectId.isValid(userId) ||
    typeof teamId !== 'string' ||
    !Types.ObjectId.isValid(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw Object.assign(new Error('Activity requires valid userId, teamId, type, and positive minutes'), { status: 400 });
  }

  const [user, team] = await Promise.all([User.exists({ _id: userId }), Team.exists({ _id: teamId })]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity userId and teamId must reference existing records'), { status: 400 });
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw Object.assign(new Error('Team input must be an object'), { status: 400 });
  }

  const { name, mascot, members = [] } = input as Record<string, unknown>;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof mascot !== 'string' ||
    !mascot.trim() ||
    !Array.isArray(members) ||
    members.some((member) => typeof member !== 'string' || !Types.ObjectId.isValid(member))
  ) {
    throw Object.assign(new Error('Team requires a name, mascot, and valid member IDs'), { status: 400 });
  }

  const memberIds = [...new Set(members as string[])];
  if (memberIds.length > 0 && (await User.countDocuments({ _id: { $in: memberIds } })) !== memberIds.length) {
    throw Object.assign(new Error('Team members must reference existing users'), { status: 400 });
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const teamTotals = await Activity.aggregate<{ teamName: string; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    {
      $lookup: {
        from: Team.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);

  return teamTotals.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const activity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).lean();
  const recentActivityType = activity?.type.toLowerCase();
  const activityFocus = recentActivityType === 'run' || recentActivityType === 'cycle' || recentActivityType === 'walk'
    ? 'endurance'
    : recentActivityType ?? user.fitnessGoal.toLowerCase();
  const workouts = await Workout.find().lean();

  return workouts
    .sort((left, right) => {
      const leftMatches = left.focus.toLowerCase() === activityFocus;
      const rightMatches = right.focus.toLowerCase() === activityFocus;
      return Number(rightMatches) - Number(leftMatches) || left.title.localeCompare(right.title);
    })
    .map((workout) => ({
      ...workout,
      reason: workout.focus.toLowerCase() === activityFocus
        ? `Matches your ${activity ? `${activity.type} activity` : `${user.fitnessGoal} goal`} (${activityFocus}).`
        : `Suggested as an alternative to your ${activity ? `${activity.type} activity` : `${user.fitnessGoal} goal`}.`,
    }));
}

export { User };
