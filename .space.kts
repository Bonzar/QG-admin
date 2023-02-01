job("Warmup data for IDEA") {
    // optional
    startOn {
        // run on schedule every day at 5AM
        schedule { cron("0 5 * * *") }
        // run on every commit...
        gitPush {
            // ...but only to the main branch
            branchFilter {
                +"refs/heads/main"
            }
        }
    }

    warmup(ide = Ide.WebStorm) {
        // path to the warm-up script
        // scriptLocation = "./dev-env-warmup.sh"
        // use image specified in the devfile
        devfile = ".space/devfile.yaml"
    }

    // optional
    git {
        // fetch the entire commit history
        depth = UNLIMITED_DEPTH
        // fetch all branches
        refSpec = "refs/*:refs/*"
    }
}