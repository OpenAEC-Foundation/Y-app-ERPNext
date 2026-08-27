use std::fs;
use std::path::Path;

/// Recursief een map kopiëren (mappen + bestanden). Geen overschrijven:
/// als `dst` al bestaat is dat de verantwoordelijkheid van de caller.
fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn create_project_folders(master_path: String, target_path: String) -> Result<(), String> {
    let master = Path::new(&master_path);
    let target = Path::new(&target_path);
    if !master.is_dir() {
        return Err("master_not_found".to_string());
    }
    if target.exists() {
        return Err("target_exists".to_string());
    }
    if let Err(e) = copy_dir_recursive(master, target) {
        // Opruimen van een half-gekopieerde doelmap.
        let _ = fs::remove_dir_all(target);
        return Err(format!("io: {}", e));
    }
    Ok(())
}

/// Open een (project)map in de OS-bestandsbeheerder (Windows Verkenner).
/// `Err("not_found")` als het pad niet bestaat. We wachten niet op het proces
/// (explorer.exe geeft soms exitcode 1 terug ook bij succes); `spawn` faalt
/// alleen als de bestandsbeheerder niet gestart kan worden.
#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err("not_found".to_string());
    }
    #[cfg(target_os = "windows")]
    let mut cmd = std::process::Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(&path);
    cmd.spawn().map(|_| ()).map_err(|e| format!("io: {}", e))
}

/// Open een native map-picker dialoog en geef het geselecteerde pad terug.
/// `Ok(None)` als de gebruiker annuleert. Desktop-only: rfd heeft geen
/// Android-backend, dus op Android compileren we de rfd-tak niet mee (de knop is
/// sowieso `isDesktopApp()`-gated en bereikt Android niet).
#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    #[cfg(not(target_os = "android"))]
    {
        let folder = rfd::AsyncFileDialog::new().pick_folder().await;
        Ok(folder.map(|h| h.path().to_string_lossy().to_string()))
    }
    #[cfg(target_os = "android")]
    {
        Err("folder picker not supported on Android".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn unique_tmp(name: &str) -> std::path::PathBuf {
        // Gebruik de proces-id + naam i.p.v. een random crate.
        env::temp_dir().join(format!("yapp_nas_test_{}_{}", std::process::id(), name))
    }

    #[test]
    fn copies_nested_structure_and_files() {
        let master = unique_tmp("master");
        let target = unique_tmp("target");
        let _ = fs::remove_dir_all(&master);
        let _ = fs::remove_dir_all(&target);
        fs::create_dir_all(master.join("01 Correspondentie")).unwrap();
        fs::create_dir_all(master.join("04 Tekeningen/sub")).unwrap();
        fs::write(master.join("01 Correspondentie/readme.txt"), b"hallo").unwrap();

        create_project_folders(
            master.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(target.join("01 Correspondentie").is_dir());
        assert!(target.join("04 Tekeningen/sub").is_dir());
        assert_eq!(
            fs::read_to_string(target.join("01 Correspondentie/readme.txt")).unwrap(),
            "hallo"
        );

        let _ = fs::remove_dir_all(&master);
        let _ = fs::remove_dir_all(&target);
    }

    #[test]
    fn refuses_when_target_exists() {
        let master = unique_tmp("master2");
        let target = unique_tmp("target2");
        fs::create_dir_all(&master).unwrap();
        fs::create_dir_all(&target).unwrap();
        let err = create_project_folders(
            master.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert_eq!(err, "target_exists");
        let _ = fs::remove_dir_all(&master);
        let _ = fs::remove_dir_all(&target);
    }

    #[test]
    fn errors_when_master_missing() {
        let target = unique_tmp("target3");
        let err = create_project_folders(
            unique_tmp("does_not_exist").to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
        )
        .unwrap_err();
        assert_eq!(err, "master_not_found");
    }
}
