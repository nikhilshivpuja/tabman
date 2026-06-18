export async function getTabGroupInfo(tab) {
  if (tab.groupId == null || tab.groupId === -1) {
    return null;
  }

  try {
    const group = await chrome.tabGroups.get(tab.groupId);
    return {
      groupId: group.id,
      title: group.title || null,
      color: group.color || null,
    };
  } catch {
    return {
      groupId: tab.groupId,
      title: null,
      color: null,
    };
  }
}

export const TAB_GROUP_COLORS = {
  grey: '#9aa0a6',
  blue: '#5b8def',
  red: '#e57373',
  yellow: '#fff176',
  green: '#81c784',
  pink: '#f48fb1',
  purple: '#b39ddb',
  cyan: '#4dd0e1',
  orange: '#ffb74d',
};
