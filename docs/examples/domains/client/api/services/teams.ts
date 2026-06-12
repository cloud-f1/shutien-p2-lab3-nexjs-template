import type { AxiosRequestConfig } from "axios";
import { apiClient } from "../client";
import {
  teamReadSchema,
  teamReadWithRoleSchema,
  teamMemberReadSchema,
} from "../../schemas/team";
import type {
  TeamCreate,
  TeamUpdate,
  TeamRead,
  TeamReadWithRole,
  TeamMemberCreate,
  TeamMemberUpdate,
  TeamMemberRead,
} from "../../schemas/team";

const BASE = "/teams";

export const teamsService = {
  /** POST /teams — create a team (caller becomes owner). */
  create: async (
    data: TeamCreate,
    config?: AxiosRequestConfig,
  ): Promise<TeamRead> => {
    const res = await apiClient.post(BASE, data, config);
    return teamReadSchema.parse(res.data);
  },

  /** GET /teams — list teams the current user belongs to. */
  list: async (config?: AxiosRequestConfig): Promise<TeamReadWithRole[]> => {
    const res = await apiClient.get(BASE, config);
    return teamReadWithRoleSchema.array().parse(res.data);
  },

  /** GET /teams/:id — get team details. */
  getById: async (
    id: string,
    config?: AxiosRequestConfig,
  ): Promise<TeamRead> => {
    const res = await apiClient.get(`${BASE}/${id}`, config);
    return teamReadSchema.parse(res.data);
  },

  /** PATCH /teams/:id — update team. */
  update: async (
    id: string,
    data: TeamUpdate,
    config?: AxiosRequestConfig,
  ): Promise<TeamRead> => {
    const res = await apiClient.patch(`${BASE}/${id}`, data, config);
    return teamReadSchema.parse(res.data);
  },

  /** DELETE /teams/:id — delete team. */
  remove: async (id: string, config?: AxiosRequestConfig): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`, config);
  },

  /** GET /teams/:id/members — list team members. */
  listMembers: async (
    teamId: string,
    config?: AxiosRequestConfig,
  ): Promise<TeamMemberRead[]> => {
    const res = await apiClient.get(`${BASE}/${teamId}/members`, config);
    return teamMemberReadSchema.array().parse(res.data);
  },

  /** POST /teams/:id/members — add a member. */
  addMember: async (
    teamId: string,
    data: TeamMemberCreate,
    config?: AxiosRequestConfig,
  ): Promise<TeamMemberRead> => {
    const res = await apiClient.post(
      `${BASE}/${teamId}/members`,
      data,
      config,
    );
    return teamMemberReadSchema.parse(res.data);
  },

  /** PATCH /teams/:id/members/:userId — change a member's role. */
  updateMember: async (
    teamId: string,
    userId: string,
    data: TeamMemberUpdate,
    config?: AxiosRequestConfig,
  ): Promise<TeamMemberRead> => {
    const res = await apiClient.patch(
      `${BASE}/${teamId}/members/${userId}`,
      data,
      config,
    );
    return teamMemberReadSchema.parse(res.data);
  },

  /** DELETE /teams/:id/members/:userId — remove a member. */
  removeMember: async (
    teamId: string,
    userId: string,
    config?: AxiosRequestConfig,
  ): Promise<void> => {
    await apiClient.delete(`${BASE}/${teamId}/members/${userId}`, config);
  },
};
