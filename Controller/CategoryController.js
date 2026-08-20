import AsyncStorage from '@react-native-async-storage/async-storage';

const CATEGORIES_STORAGE_KEY = 'user_categories';
const DEFAULT_CATEGORIES = ['All', 'Family', 'Official', 'Important'];

class CategoryController {

  // Get all categories (with defaults if none exist)
  static async getCategories() {
    try {
      const stored = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return DEFAULT_CATEGORIES;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return DEFAULT_CATEGORIES;
    }
  }

  // Save categories list
  static async saveCategories(categories) {
    try {
      await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
      return true;
    } catch (error) {
      console.error('Error saving categories:', error);
      return false;
    }
  }

  // Add a new category
  static async addCategory(name) {
    try {
      const current = await this.getCategories();
      if (!current.includes(name)) {
        const updated = [...current, name];
        await this.saveCategories(updated);
        return updated;
      }
      return current;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  // Rename a category
  static async renameCategory(oldName, newName) {
    try {
      const current = await this.getCategories();
      const index = current.indexOf(oldName);
      if (index !== -1) {
        // Prevent duplicate names
        if (current.includes(newName)) {
          throw new Error("Category name already exists");
        }

        const updated = [...current];
        updated[index] = newName;
        await this.saveCategories(updated);
        return updated;
      }
      return current;
    } catch (error) {
      console.error('Error renaming category:', error);
      throw error;
    }
  }

  // Delete a category
  static async deleteCategory(name) {
    try {
      const current = await this.getCategories();
      const updated = current.filter(c => c !== name);
      if (updated.length === current.length) return current; // Nothing deleted

      await this.saveCategories(updated);
      return updated;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // Reset to defaults (debug/help)
  static async resetCategories() {
    try {
      await this.saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    } catch (error) {
      console.error('Error resetting categories:', error);
      return DEFAULT_CATEGORIES;
    }
  }
}

export default CategoryController;
